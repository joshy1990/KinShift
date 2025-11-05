import auth from '@react-native-firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch } from '@/config/firestore.compat';
import {User} from '@/types/index';
import { db, COLLECTIONS } from '@/config/firebase.config';
import { householdService } from './household.service';

class AuthService {
  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email: string, password: string, name: string): Promise<User> {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const {uid} = userCredential.user;

      // Update display name
      await userCredential.user.updateProfile({displayName: name});

      // Create user document in Firestore
      const userData: User = {
        id: uid,
        name,
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection(COLLECTIONS.USERS).doc(uid).set(userData);

      return userData;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<User> {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;
      try {
        const user = await this.getUserData(uid);
        return user;
      } catch {
        console.warn('[AuthService] Failed to fetch user data, using Firebase Auth fallback');
        // If user doc is missing or Firestore fails, create it from Auth and proceed
        const fallbackUser: User = {
          id: uid,
          name: userCredential.user.displayName || '',
          email: userCredential.user.email || email,
          photoUrl: userCredential.user.photoURL || undefined,
          createdAt: new Date(userCredential.user.metadata.creationTime || Date.now()),
          updatedAt: new Date(),
        };
        try {
          await db.collection(COLLECTIONS.USERS).doc(uid).set(fallbackUser);
        } catch (setDocError) {
          console.error('[AuthService] Failed to create user doc:', setDocError);
        }
        return fallbackUser;
      }
    } catch (error: any) {
      console.error('[AuthService] Sign in failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      await auth().signOut();
    } catch (error: any) {
      throw new Error('Failed to sign out');
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) {
      return null;
    }

    return {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || '',
      email: firebaseUser.email || '',
      photoUrl: firebaseUser.photoURL || undefined,
      createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
      updatedAt: new Date(),
    };
  }

  /**
   * Get user data from Firestore with retry logic
   * Uses aggressive timeout to force fallback from WebChannel to long-polling
   */
  async getUserData(userId: string, retries: number = 5): Promise<User> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Add a timeout wrapper to force fallback faster
        const timeoutMs = attempt === 0 ? 4000 : 3000; // More time for first attempt (WebChannel -> long-polling)
        
        const userDocRef = doc(db, COLLECTIONS.USERS, userId);
        
        // Race between getDoc and timeout
        const userDocPromise = getDoc(userDocRef);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Firestore timeout after ${timeoutMs}ms`)), timeoutMs)
        );
        
        const userDoc = await Promise.race([userDocPromise, timeoutPromise]) as any;

        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        return userDoc.data() as User;
      } catch (error: any) {
        // Exponential backoff: 1s, 2s, 3s, 4s, 5s
        const delay = 1000 * (attempt + 1);
        console.warn(`⚠️ [AuthService] Attempt ${attempt + 1}/${retries} failed: ${error.message}`);
        
        // If this is the last attempt, throw the error
        if (attempt === retries - 1) {
          console.error(`❌ [AuthService] All ${retries} retry attempts failed for user ${userId}`);
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Failed to fetch user data after all retries');
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const userDocRef = doc(db, COLLECTIONS.USERS, userId);
      await updateDoc(userDocRef, {
        ...updates,
        updatedAt: new Date(),
      });

      // Update Firebase Auth profile if name or photo changed
      const currentUser = auth().currentUser;
      if (currentUser) {
        const profileUpdates: any = {};
        if (updates.name) {
          profileUpdates.displayName = updates.name;
        }
        if (updates.photoUrl) {
          profileUpdates.photoURL = updates.photoUrl;
        }
        if (Object.keys(profileUpdates).length > 0) {
          await currentUser.updateProfile(profileUpdates);
        }
      }
    } catch {
      throw new Error('Failed to update profile');
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    try {
      await auth().sendPasswordResetEmail(email);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Delete user account and all associated data
   * Requires recent authentication
   */
  async deleteAccount(password: string): Promise<void> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('No authenticated user found');
      }

      // Re-authenticate user before deletion (Firebase requires this for security)
      const credential = auth.EmailAuthProvider.credential(currentUser.email, password);
      await currentUser.reauthenticateWithCredential(credential);

      const userId = currentUser.uid;
      const batch = writeBatch(db);

      // Handle households: Transfer admin rights or remove from households
      const householdsQuery = query(
        collection(db, COLLECTIONS.HOUSEHOLDS),
        where('members', 'array-contains', userId)
      );
      const householdsSnapshot = await getDocs(householdsQuery);
      const householdsToDowngrade: Array<{householdId: string; householdData: any; newAdminId: string}> = [];
      
      for (const householdDoc of householdsSnapshot.docs) {
        const household = householdDoc.data();
        const householdRef = doc(db, COLLECTIONS.HOUSEHOLDS, householdDoc.id);
        
        // Remove user from members and admins arrays
        const updatedMembers = household.members.filter((id: string) => id !== userId);
        const updatedAdmins = household.admins.filter((id: string) => id !== userId);

        if (updatedMembers.length === 0) {
          // If no members left, delete the household
          batch.delete(householdRef);
          
          // Also delete all household shifts
          const householdShiftsQuery = query(
            collection(db, COLLECTIONS.SHIFTS),
            where('householdId', '==', householdDoc.id)
          );
          const householdShiftsSnapshot = await getDocs(householdShiftsQuery);
          householdShiftsSnapshot.docs.forEach((shiftDoc: any) => {
            batch.delete(shiftDoc.ref);
          });

          // Delete all household day notes
          const householdNotesQuery = query(
            collection(db, COLLECTIONS.DAY_NOTES),
            where('householdId', '==', householdDoc.id)
          );
          const householdNotesSnapshot = await getDocs(householdNotesQuery);
          householdNotesSnapshot.docs.forEach((noteDoc: any) => {
            batch.delete(noteDoc.ref);
          });
        } else {
          // If user was the only admin, promote the next member to admin
          let finalAdmins = updatedAdmins;
          const newAdminId = updatedAdmins.length === 0 && updatedMembers.length > 0 
            ? updatedMembers[0] 
            : undefined;
          
          if (newAdminId) {
            // Promote the first remaining member to admin
            finalAdmins = [newAdminId];
            
            // Track for downgrade workflow after batch commits
            householdsToDowngrade.push({
              householdId: householdDoc.id,
              householdData: household,
              newAdminId,
            });
          }

          // Update household with new members and admins
          batch.update(householdRef, {
            members: updatedMembers,
            admins: finalAdmins,
            updatedAt: new Date(),
          });
        }
      }

      // Delete user's personal shifts (shifts without householdId or where user is owner)
      const shiftsQuery = query(
        collection(db, COLLECTIONS.SHIFTS),
        where('ownerId', '==', userId)
      );
      const shiftsSnapshot = await getDocs(shiftsQuery);
      shiftsSnapshot.docs.forEach((shiftDoc: any) => {
        batch.delete(shiftDoc.ref);
      });

      // Delete user's personal day notes
      const notesQuery = query(
        collection(db, COLLECTIONS.DAY_NOTES),
        where('authorId', '==', userId)
      );
      const notesSnapshot = await getDocs(notesQuery);
      notesSnapshot.docs.forEach((noteDoc: any) => {
        batch.delete(noteDoc.ref);
      });

      // Delete user document
      const userDocRef = doc(db, COLLECTIONS.USERS, userId);
      batch.delete(userDocRef);

      // Commit all deletions
      await batch.commit();

      // Handle tier downgrade for households where new admin was promoted
      // This happens asynchronously after the batch commit to avoid delays
      if (householdsToDowngrade.length > 0) {
        (async () => {
          try {
            for (const {householdId, newAdminId} of householdsToDowngrade) {
              try {
                await householdService.handleAdminPromotionAndDowngrade(
                  householdId,
                  newAdminId,
                  userId // Previous admin
                );
              } catch {
                console.warn(`⚠️ Failed to handle downgrade for household ${householdId}`);
                // Continue with other households
              }
            }
          } catch {
            console.warn('⚠️ Failed to process household downgrades');
          }
        })();
      }

      // Delete Firebase Auth account
      await currentUser.delete();
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password');
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error('Please sign out and sign in again before deleting your account');
      }
      throw new Error(error.message || 'Failed to delete account');
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userData = await this.getUserData(firebaseUser.uid);
          callback(userData);
        } catch (error: any) {
          console.warn('[AuthService] ⚠️ Failed to load user data from Firestore after all retries:', error.message);
          console.warn('[AuthService] Falling back to Firebase Auth data...');
          
          // Create basic user object from Firebase Auth as fallback
          const basicUserData: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            photoUrl: firebaseUser.photoURL || null,
            createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
            updatedAt: new Date(),
          };
          
          // Try to create the missing Firestore document (exclude photoUrl if null)
          try {
            const docData = { ...basicUserData };
            if (!docData.photoUrl) {
              delete docData.photoUrl;
            }
            await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), docData);
          } catch (firestoreError: any) {
            console.warn('[AuthService] Could not create Firestore document (will retry later):', firestoreError.message);
            // Continue anyway - app will work with basic data
          }
          
          // Return the user data (will use Firebase Auth data as fallback)
          callback(basicUserData);
        }
      } else {
        callback(null);
      }
    });
  }

  /**
   * Handle Firebase auth errors
   */
  private handleAuthError(error: any): Error {
    console.error('[AuthService] Auth error:', error.code, error.message);
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        return new Error('This email is already registered');
      case 'auth/invalid-email':
        return new Error('Invalid email address');
      case 'auth/weak-password':
        return new Error('Password must be at least 6 characters');
      case 'auth/user-not-found':
        return new Error('No account found with this email');
      case 'auth/wrong-password':
        return new Error('Incorrect password');
      case 'auth/too-many-requests':
        return new Error('Too many attempts. Please try again later');
      case 'auth/network-request-failed':
        return new Error('Network connection failed. Check your internet connection and try again.');
      case 'auth/internal-error':
        return new Error('Server error. Please try again in a moment.');
      case 'auth/operation-not-allowed':
        return new Error('This operation is not allowed. Check Firebase configuration.');
      default:
        // Check if it's a network-related error by message
        if (error.message && (
          error.message.includes('Network') ||
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('fetch') ||
          error.message.includes('CORS')
        )) {
          return new Error('Network connection failed. Check your internet and try again.');
        }
        return new Error(error.message || 'Authentication failed');
    }
  }
}

export const authService = new AuthService();
