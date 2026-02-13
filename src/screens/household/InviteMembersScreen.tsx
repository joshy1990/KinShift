import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Linking,
  Modal,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HouseholdStackParamList, Invitation, User, Household} from '@/types';
import {useAuth} from '@/contexts/AuthContext';
import {invitationService} from '@/services/invitation.service';
import {householdService} from '@/services/household.service';
import {notificationService} from '@/services/notification.service';
import {deepLinkService} from '@/utils/deepLink.service';
import {showAlert, showError, showSuccess, showConfirm} from '@/utils/alert';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<HouseholdStackParamList, 'InviteMembers'>;

interface InviteForm {
  emailOrPhone: string;
  name: string;
  isAdmin: boolean;
}

export const InviteMembersScreen: React.FC<Props> = ({navigation, route}) => {
  const {user} = useAuth();
  const {householdId} = route.params;
  const insets = useSafeAreaInsets();
  
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [form, setForm] = useState<InviteForm>({
    emailOrPhone: '',
    name: '',
    isAdmin: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showShareModal, setShowShareModal] = useState(false);
  const [pendingInvitation, setPendingInvitation] = useState<Invitation | null>(null);

  const loadHousehold = useCallback(async () => {
    try {
      const householdData = await householdService.getHousehold(householdId);
      setHousehold(householdData);
    } catch (error) {
      console.error('Error loading household:', error);
      showError('Failed to load household details');
    }
  }, [householdId]);

  const loadInvitations = useCallback(async () => {
    try {
      setLoadingInvites(true);
      const invites = await invitationService.getHouseholdInvitations(householdId);
      setInvitations(invites);
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoadingInvites(false);
    }
  }, [householdId]);

  useEffect(() => {
    loadHousehold();
    loadInvitations();
  }, [loadHousehold, loadInvitations]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.emailOrPhone.trim()) {
      newErrors.emailOrPhone = 'Email address is required';
    } else {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailOrPhone);
      
      if (!isEmail) {
        newErrors.emailOrPhone = 'Please enter a valid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const sendInvitation = async () => {
    if (!validateForm() || !user || !household) return;

    try {
      setLoading(true);
      
      const invitation = await invitationService.createInvitation(
        householdId,
        form.emailOrPhone,
        user,
        form.name || undefined,
        form.isAdmin ? 'admin' : 'member'
      );

      // Store invitation and show share options modal
      setPendingInvitation(invitation);
      setShowShareModal(true);

      // Optionally notify user if they already have an account (not implemented here)

      // Reset form and reload invitations
      setForm({
        emailOrPhone: '',
        name: '',
        isAdmin: false,
      });
      
      loadInvitations();

      showSuccess(`Invitation created for ${form.emailOrPhone}`);

    } catch (error: any) {
      showError(error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const shareInvitation = async (message: string) => {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Share.share({
          message,
          title: `Join ${household?.name} on LinkShift`,
        });
      }
    } catch (error) {
      console.error('Error sharing invitation:', error);
    }
  };

  // Build a shareable message for an invitation
  const buildInvitationMessage = (inv: Invitation): string => {
    const code = (inv as any).inviteCode || (inv as any).code || '';
    const link = code ? deepLinkService.generateInvitationLink(code) : '';
    const hhName = (inv as any).householdName || household?.name || 'our household';
    return `You're invited to join ${hhName} on LinkShift.\n\nUse this link to accept: ${link}`;
  };

  const sendViaEmail = async (invitation: Invitation) => {
    try {
      const isEmail = (invitation as any).emailOrPhone?.includes('@');
      if (!isEmail) {
        showAlert('Email Required', 'This invitation is for a phone number. Please use the standard share option.');
        return;
      }

      const subject = `Join ${household?.name || 'our household'} on LinkShift`;
      const body = buildInvitationMessage(invitation);
      const mailto = `mailto:${encodeURIComponent((invitation as any).emailOrPhone)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      await Linking.openURL(mailto);
      setShowShareModal(false);
      showSuccess('Email client opened');
    } catch (error) {
      console.error('Error opening email:', error);
      showError('Failed to open email client');
    }
  };

  const shareViaApp = async (invitation: Invitation) => {
    try {
      const message = buildInvitationMessage(invitation);
      await shareInvitation(message);
      setShowShareModal(false);
    } catch (error) {
      showError('Failed to share invitation');
    }
  };

  const resendInvitation = async (invitation: Invitation) => {
    try {
      const message = buildInvitationMessage(invitation);
      await shareInvitation(message);
      showSuccess('The invitation has been shared again');
    } catch (error) {
      showError('Failed to resend invitation');
    }
  };

  const cancelInvitation = async (inviteId: string) => {
    showConfirm(
      'Cancel Invitation',
      'Are you sure you want to cancel this invitation?',
      async () => {
        try {
          await invitationService.cancelInvitation(inviteId, user!.id);
          loadInvitations();
          showSuccess('The invitation has been cancelled');
        } catch (error: any) {
          showError(error.message || 'Failed to cancel invitation');
        }
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F39C12';
      case 'accepted': return '#27AE60';
      case 'declined': return '#E74C3C';
      case 'expired': return '#95A5A6';
      default: return '#7F8C8D';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'accepted': return 'Accepted';
      case 'declined': return 'Declined';
      case 'expired': return 'Expired';
      default: return status;
    }
  };

  const renderInvitation = (invitation: Invitation) => (
    <View key={invitation.id} style={styles.invitationCard}>
      <View style={styles.invitationHeader}>
        <View style={styles.invitationInfo}>
          <Text style={styles.invitationEmail}>{invitation.emailOrPhone}</Text>
          {invitation.inviteeName && (
            <Text style={styles.invitationName}>{invitation.inviteeName}</Text>
          )}
          <Text style={styles.invitationRole}>
            {invitation.role} • {getStatusText(invitation.status)}
          </Text>
        </View>
        <View style={[styles.statusBadge, {backgroundColor: getStatusColor(invitation.status)}]}>
          <Text style={styles.statusText}>{getStatusText(invitation.status).toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.invitationFooter}>
        <Text style={styles.invitationDate}>
          Sent {((invitation.createdAt as any)?.toDate ? (invitation.createdAt as any).toDate() : new Date(invitation.createdAt)).toLocaleDateString()}
        </Text>
        <View style={styles.invitationActions}>
          {invitation.status === 'pending' && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => resendInvitation(invitation)}
              >
                <Text style={styles.actionButtonText}>Resend</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => cancelInvitation(invitation.id)}
              >
                <Text style={[styles.actionButtonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Invitation</Text>
          <Text style={styles.sectionDescription}>
            Invite family members to join "{household?.name}" and start coordinating shifts together.
          </Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            style={[styles.input, errors.emailOrPhone ? styles.inputError : null]}
            value={form.emailOrPhone}
            onChangeText={(text) => setForm(prev => ({...prev, emailOrPhone: text}))}
            placeholder="example@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.emailOrPhone && (
            <Text style={styles.errorText}>{errors.emailOrPhone}</Text>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Name (Optional)</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(text) => setForm(prev => ({...prev, name: text}))}
            placeholder="John Doe"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.formGroup}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Make Admin</Text>
              <Text style={styles.switchDescription}>
                Admins can invite others and manage household settings
              </Text>
            </View>
            <Switch
              value={form.isAdmin}
              onValueChange={(value) => setForm(prev => ({...prev, isAdmin: value}))}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={sendInvitation}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.sendButtonText}>Send Invitation</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sent Invitations</Text>
        
        {loadingInvites ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading invitations...</Text>
          </View>
        ) : invitations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No invitations sent yet</Text>
            <Text style={styles.emptySubtext}>Send your first invitation above</Text>
          </View>
        ) : (
          invitations.map(renderInvitation)
        )}
      </View>
    </ScrollView>

    {/* Share Options Modal */}
    <Modal
      visible={showShareModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowShareModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Invitation</Text>
            <TouchableOpacity onPress={() => setShowShareModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {pendingInvitation && (
            <>
              <View style={styles.invitationDetails}>
                <Text style={styles.detailLabel}>Invitation Code:</Text>
                <Text style={styles.detailCode}>{pendingInvitation.inviteCode || (pendingInvitation as any).code || ''}</Text>
                
                <Text style={styles.detailLabel}>Expires:</Text>
                <Text style={styles.detailValue}>
                  {((pendingInvitation.expiresAt as any)?.toDate ? (pendingInvitation.expiresAt as any).toDate() : new Date(pendingInvitation.expiresAt)).toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.shareOptions}>
                <TouchableOpacity
                  style={styles.shareOptionButton}
                  onPress={() => sendViaEmail(pendingInvitation)}
                >
                  <Text style={styles.shareOptionEmoji}>📧</Text>
                  <View style={styles.shareOptionText}>
                    <Text style={styles.shareOptionTitle}>Send via Email</Text>
                    <Text style={styles.shareOptionDescription}>
                      Opens your email client with a pre-filled template
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareOptionButton}
                  onPress={() => shareViaApp(pendingInvitation)}
                >
                  <Text style={styles.shareOptionEmoji}>📤</Text>
                  <View style={styles.shareOptionText}>
                    <Text style={styles.shareOptionTitle}>Share via Message/App</Text>
                    <Text style={styles.shareOptionDescription}>
                      Share using your preferred messaging app
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => setShowShareModal(false)}
              >
                <Text style={styles.dismissButtonText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  section: {
    backgroundColor: '#1A1A2E',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F1F3F',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 20,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#0F0F23',
    color: '#E5E7EB',
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  switchDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  sendButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  sendButtonDisabled: {
    backgroundColor: '#4B5563',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#9CA3AF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  invitationCard: {
    borderWidth: 1,
    borderColor: '#1F1F3F',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#0F0F23',
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  invitationName: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 2,
  },
  invitationRole: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  invitationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invitationDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#6366F1',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: '#DC2626',
  },
  cancelButtonText: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F3F',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalClose: {
    fontSize: 24,
    color: '#9CA3AF',
    fontWeight: '300',
  },
  invitationDetails: {
    backgroundColor: '#0F0F23',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 12,
    marginBottom: 4,
  },
  detailCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  detailValue: {
    fontSize: 14,
    color: '#E5E7EB',
  },
  shareOptions: {
    marginBottom: 20,
  },
  shareOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F23',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F1F3F',
  },
  shareOptionEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  shareOptionText: {
    flex: 1,
  },
  shareOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 2,
  },
  shareOptionDescription: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  dismissButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
