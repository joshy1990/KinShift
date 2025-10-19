import { collection, doc, addDoc, updateDoc, getDoc, getDocs, query, where, Timestamp, writeBatch } from 'firebase/firestore';
import {Invitation, User} from '@/types';
import {householdService} from './household.service';
import {notificationService} from './notification.service';
import {COLLECTIONS, db} from '@/config/firebase.config';

class InvitationService {
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  async createInvitation(householdId: string, emailOrPhone: string, inviterUser: User, inviteeName?: string, role: 'member' | 'admin' = 'member'): Promise<Invitation> {
    const household = await householdService.getHousehold(householdId);
    if (!household) throw new Error('Household not found');
    if (!household.admins.includes(inviterUser.id)) throw new Error('Only household admins can send invitations');
    const normalizedEmail = emailOrPhone.toLowerCase().trim();
    if (!this.validateEmail(normalizedEmail)) throw new Error('Invalid email address');
    let inviteCode = this.generateInviteCode();
    const inviterName = (inviterUser as any).displayName || inviterUser.email;
    const invitation: any = {
      code: inviteCode,
      householdId,
      householdName: household.name,
      inviterUserId: inviterUser.id,
      inviterName,
      inviteeEmail: normalizedEmail,
      inviteeName: inviteeName || normalizedEmail,
      role,
      status: 'pending',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    };
    const invitationsRef = collection(db, COLLECTIONS.INVITATIONS);
    const docRef = await addDoc(invitationsRef, invitation);
    const createdInvitation = { id: docRef.id, ...invitation } as Invitation;

    // Send notification if invitee has an account (if lookup is implemented)
    try {
      // Try to find user by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', normalizedEmail));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const invitedUserId = snapshot.docs[0].id;
        await notificationService.notifyInvitationAccepted(
          invitedUserId,
          householdId,
          household.name,
          household.members.length
        );
      }
    } catch (notificationError) {
      // Don't fail the invitation if notification fails
      console.warn('[InvitationService] Notification failed but invitation created:', notificationError);
    }

    return createdInvitation;
  }

  async getInvitationByCode(inviteCode: string): Promise<Invitation | null> {
    const invitationsRef = collection(db, COLLECTIONS.INVITATIONS);
    const q = query(invitationsRef, where('code', '==', inviteCode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Invitation;
  }

  async acceptInvitation(inviteCode: string, acceptingUser: User): Promise<void> {
    const invitation = await this.getInvitationByCode(inviteCode);
    if (!invitation) throw new Error('Invitation not found');
    if (invitation.status !== 'pending') throw new Error('This invitation has already been used or cancelled');
    await householdService.addMemberToHousehold(invitation.householdId, acceptingUser.id, invitation.role);
    const invitationRef = doc(db, COLLECTIONS.INVITATIONS, invitation.id);
    await updateDoc(invitationRef, { status: 'accepted', acceptedAt: Timestamp.now(), acceptedByUserId: acceptingUser.id });
  }

  async getHouseholdInvitations(householdId: string): Promise<Invitation[]> {
    const invitationsRef = collection(db, COLLECTIONS.INVITATIONS);
    const q = query(invitationsRef, where('householdId', '==', householdId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invitation[];
  }

  async cancelInvitation(inviteId: string, cancellingUserId: string): Promise<void> {
    const invitationRef = doc(db, COLLECTIONS.INVITATIONS, inviteId);
    const invitationSnap = await getDoc(invitationRef);
    if (!invitationSnap.exists()) throw new Error('Invitation not found');
    const invitation = invitationSnap.data() as Invitation;
    const household = await householdService.getHousehold(invitation.householdId);
    if (!household.admins.includes(cancellingUserId)) throw new Error('Only household admins can cancel invitations');
    await updateDoc(invitationRef, { status: 'cancelled', cancelledAt: Timestamp.now(), cancelledByUserId: cancellingUserId });
  }
}

export const invitationService = new InvitationService();
