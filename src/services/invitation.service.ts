import { collection, doc, addDoc, updateDoc, getDoc, getDocs, query, where, Timestamp, writeBatch, limit, deleteDoc } from '@/config/firestore.compat';
import {Invitation, User} from '@/types';
import {householdService} from './household.service';
import {notificationService} from './notification.service';
import {rbacService, AuditAction} from './rbac.service';
import {auditService} from './audit.service';
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
    // RBAC Enforcement: Only admins can send invitations
    const adminCheck = await rbacService.enforceAdminOnly(householdId, inviterUser.id, AuditAction.MEMBER_INVITE);
    if (!adminCheck.allowed) {
      throw new Error(adminCheck.reason || 'Unauthorized to send invitations');
    }

    const household = await householdService.getHousehold(householdId);
    if (!household) throw new Error('Household not found');
    
    const normalizedEmail = emailOrPhone.toLowerCase().trim();
    if (!this.validateEmail(normalizedEmail)) throw new Error('Invalid email address');
    
    // Prevent self-invites
    if (normalizedEmail === inviterUser.email) {
      await auditService.logHouseholdAction(householdId, inviterUser.id, AuditAction.MEMBER_INVITE, { error: 'Cannot invite self' });
      throw new Error('Cannot send invitation to yourself');
    }

    const inviteCode = this.generateInviteCode();
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

    // Log successful invitation creation
    await auditService.logHouseholdAction(householdId, inviterUser.id, AuditAction.MEMBER_INVITE, { invitedEmail: normalizedEmail });

    // Send notification if invitee has an account (if lookup is implemented)
    try {
      // Try to find user by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', normalizedEmail));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const invitedUserId = snapshot.docs[0].id;
        await notificationService.notifyInvitationReceived(
          invitedUserId,
          householdId,
          household.name,
          inviterName
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
    
    // Check expiration
    const expiresAt = (invitation as any).expiresAt?.toDate ? (invitation as any).expiresAt.toDate() : new Date((invitation as any).expiresAt);
    if (expiresAt < new Date()) {
      // Update status to expired
      const invitationRef = doc(db, COLLECTIONS.INVITATIONS, invitation.id);
      await updateDoc(invitationRef, { status: 'expired' });
      throw new Error('This invitation has expired');
    }
    
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
    
    // RBAC Enforcement: Only admins can cancel invitations
    const adminCheck = await rbacService.enforceAdminOnly(invitation.householdId, cancellingUserId, AuditAction.MEMBER_INVITE);
    if (!adminCheck.allowed) {
      throw new Error(adminCheck.reason || 'Unauthorized to cancel invitations');
    }
    
    await updateDoc(invitationRef, { status: 'cancelled', cancelledAt: Timestamp.now(), cancelledByUserId: cancellingUserId });
    
    // Log successful cancellation
    await auditService.logHouseholdAction(invitation.householdId, cancellingUserId, AuditAction.MEMBER_INVITE, { cancelled: true });
  }

  // ============================================
  // DATA RETENTION / PURGE
  // ============================================

  /**
   * Hard-delete invitations that expired more than `graceDays` ago.
   * Expired/cancelled invitations have no value after a short grace period.
   */
  async purgeExpiredInvitations(graceDays: number = 7): Promise<number> {
    const cutoff = Timestamp.fromDate(
      new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000)
    );

    const q = query(
      collection(db, COLLECTIONS.INVITATIONS),
      where('status', 'in', ['expired', 'cancelled']),
      where('expiresAt', '<=', cutoff),
      limit(500)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;

    let deleted = 0;
    const refs = snapshot.docs.map((d) => d.ref);

    for (let i = 0; i < refs.length; i += 499) {
      const chunk = refs.slice(i, i + 499);
      const batch = writeBatch(db);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
      deleted += chunk.length;
    }

    console.log(`[InvitationService] Purged ${deleted} expired/cancelled invitations older than ${graceDays}d`);
    return deleted;
  }
}

export const invitationService = new InvitationService();
