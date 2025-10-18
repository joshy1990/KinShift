import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, User as FirebaseUser, onAuthStateChanged, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import {User} from '@/types/index';
import { auth, db, COLLECTIONS } from '@/config/firebase.config';
import { householdService } from './household.service';

class AuthService {
  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email: string, password: string, name: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const {uid} = userCredential.user;

      // Update display name
      await updateProfile(userCredential.user, {displayName: name});

      // Create user document in Firestore
      const userData: User = {
        id: uid,
        name,
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, COLLECTIONS.USERS, uid), userData);

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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      try {
        const user = await this.getUserData(uid);
        return user;
      } catch (e) {
        // If user doc is missing, create it from Auth and proceed
        const fallbackUser: User = {
          id: uid,
          name: userCredential.user.displayName || '',
          email: userCredential.user.email || email,
          photoUrl: userCredential.user.photoURL || undefined,
          createdAt: new Date(userCredential.user.metadata.creationTime || Date.now()),
          updatedAt: new Date(),
        };
        try {
          await setDoc(doc(db, COLLECTIONS.USERS, uid), fallbackUser);
        } catch {}
        return fallbackUser;
      }
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error('Failed to sign out');
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    const firebaseUser = auth.currentUser;
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
   * Get user data from Firestore
   */
  async getUserData(userId: string): Promise<User> {
    try {
      const userDocRef = doc(db, COLLECTIONS.USERS, userId);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      return userDoc.data() as User;
    } catch (error) {
      throw new Error('Failed to fetch user data');
    }
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
      const currentUser = auth.currentUser;
      if (currentUser) {
        const profileUpdates: any = {};
        if (updates.name) {
          profileUpdates.displayName = updates.name;
        }
        if (updates.photoUrl) {
          profileUpdates.photoURL = updates.photoUrl;
        }
        if (Object.keys(profileUpdates).length > 0) {
          await updateProfile(currentUser, profileUpdates);
        }
      }
    } catch (error) {
      throw new Error('Failed to update profile');
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, email);
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
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('No authenticated user found');
      }

      // Re-authenticate user before deletion (Firebase requires this for security)
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);

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
          householdShiftsSnapshot.forEach((shiftDoc) => {
            batch.delete(shiftDoc.ref);
          });

          // Delete all household day notes
          const householdNotesQuery = query(
            collection(db, COLLECTIONS.DAY_NOTES),
            where('householdId', '==', householdDoc.id)
          );
          const householdNotesSnapshot = await getDocs(householdNotesQuery);
          householdNotesSnapshot.forEach((noteDoc) => {
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
      shiftsSnapshot.forEach((shiftDoc) => {
        batch.delete(shiftDoc.ref);
      });

      // Delete user's personal day notes
      const notesQuery = query(
        collection(db, COLLECTIONS.DAY_NOTES),
        where('authorId', '==', userId)
      );
      const notesSnapshot = await getDocs(notesQuery);
      notesSnapshot.forEach((noteDoc) => {
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
            for (const {householdId, householdData, newAdminId} of householdsToDowngrade) {
              try {
                await householdService.handleAdminPromotionAndDowngrade(
                  householdId,
                  newAdminId,
                  userId // Previous admin
                );
              } catch (downgradeError) {
                console.warn(`⚠️ Failed to handle downgrade for household ${householdId}:`, downgradeError);
                // Continue with other households
              }
            }
          } catch (error) {
            console.warn('⚠️ Failed to process household downgrades:', error);
          }
        })();
      }

      // Delete Firebase Auth account
      await deleteUser(currentUser);
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
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          console.log('[AuthService] Firebase user detected:', firebaseUser.uid, firebaseUser.email);
          const userData = await this.getUserData(firebaseUser.uid);
          console.log('[AuthService] User data loaded from Firestore:', userData);
          callback(userData);
        } catch (error) {
          console.error('[AuthService] Failed to load user data from Firestore:', error);
          // If Firestore user document doesn't exist, create basic user object from Firebase Auth
          const basicUserData: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            photoUrl: firebaseUser.photoURL || null,
            createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
            updatedAt: new Date(),
          };
          console.log('[AuthService] Using basic user data from Firebase Auth:', basicUserData);
          
          // Try to create the missing Firestore document (exclude photoUrl if null)
          try {
            const docData = { ...basicUserData };
            if (!docData.photoUrl) {
              delete docData.photoUrl;
            }
            await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), docData);
            console.log('[AuthService] Created missing Firestore user document');
          } catch (firestoreError) {
            console.error('[AuthService] Failed to create Firestore user document:', firestoreError);
          }
          
          callback(basicUserData);
        }
      } else {
        console.log('[AuthService] No Firebase user - user is logged out');
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
