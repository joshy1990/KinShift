import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HouseholdStackParamList, Invitation} from '@/types';
import {useAuth} from '@/contexts/AuthContext';
import {invitationService} from '@/services/invitation.service';
import {notificationService} from '@/services/notification.service';

type Props = NativeStackScreenProps<HouseholdStackParamList, 'InvitationAccept'>;

export const InvitationAcceptScreen: React.FC<Props> = ({navigation, route}) => {
  const {user} = useAuth();
  const {inviteCode} = route.params;
  
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvitation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const invite = await invitationService.getInvitationByCode(inviteCode);
      
      if (!invite) {
        setError('Invitation not found. It may have expired or been cancelled.');
        return;
      }

      if (invite.status !== 'pending') {
        setError(`This invitation has already been ${invite.status}.`);
        return;
      }

      if (invite.expiresAt < new Date()) {
        setError('This invitation has expired.');
        return;
      }

      setInvitation(invite);
    } catch (err) {
      console.error('Error loading invitation:', err);
      setError('Failed to load invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [inviteCode]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  const acceptInvitation = async () => {
    if (!invitation || !user) return;

    try {
      setAccepting(true);
      
      await invitationService.acceptInvitation(inviteCode, user);
      
      // Optionally notify invitee (or inviter) - using available helper signature
      try {
        await notificationService.notifyInvitationAccepted(
          user.id,
          invitation.householdId,
          invitation.householdName,
          0
        );
      } catch (notificationError) {
        console.warn('Failed to send acceptance notification:', notificationError);
      }
      
      Alert.alert(
        'Welcome!',
        `You've successfully joined "${invitation.householdName}". You can now coordinate shifts with your family.`,
        [
          {
            text: 'View Household',
            onPress: () => {
              navigation.replace('HouseholdDetail', {householdId: invitation.householdId});
            }
          }
        ]
      );
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const declineInvitation = async () => {
    setDeclining(true);
    try {
      Alert.alert(
        'Invitation Declined',
        'You have declined this invitation.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } finally {
      setDeclining(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Invitation',
      'Are you sure you want to decline this invitation?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Decline', style: 'destructive', onPress: declineInvitation}
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Loading invitation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorIcon}>
          <Text style={styles.errorIconText}>⚠️</Text>
        </View>
        <Text style={styles.errorTitle}>Invitation Issue</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.inviteIcon}>
          <Text style={styles.inviteIconText}>👨‍👩‍👧‍👦</Text>
        </View>
        <Text style={styles.title}>You're Invited!</Text>
        <Text style={styles.subtitle}>
          {invitation.inviterName} has invited you to join their household
        </Text>
      </View>

      <View style={styles.invitationCard}>
        <View style={styles.householdInfo}>
          <Text style={styles.householdName}>{invitation.householdName}</Text>
          <Text style={styles.inviterInfo}>
            Invited by {invitation.inviterName}
          </Text>
          <Text style={styles.roleInfo}>
            You'll join as a {invitation.role}
          </Text>
        </View>

        <View style={styles.detailsSection}>
          <Text style={styles.detailsTitle}>What's LinkShift?</Text>
          <Text style={styles.detailsText}>
            LinkShift helps families coordinate work schedules and shifts. You'll be able to:
          </Text>
          <View style={styles.featureList}>
            <Text style={styles.featureItem}>📅 View and manage family schedules</Text>
            <Text style={styles.featureItem}>🔄 Set up recurring shift patterns</Text>
            <Text style={styles.featureItem}>🎨 Color-coded shift types for easy viewing</Text>
            <Text style={styles.featureItem}>⚠️ Get notified about schedule conflicts</Text>
            <Text style={styles.featureItem}>👥 Coordinate with all household members</Text>
          </View>
        </View>

        {invitation.role === 'admin' && (
          <View style={styles.adminNotice}>
            <Text style={styles.adminNoticeTitle}>Admin Privileges</Text>
            <Text style={styles.adminNoticeText}>
              As an admin, you'll be able to invite others and manage household settings.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.acceptButton, accepting && styles.buttonDisabled]}
          onPress={acceptInvitation}
          disabled={accepting || declining}
        >
          {accepting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept Invitation</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.declineButton, declining && styles.buttonDisabled]}
          onPress={handleDecline}
          disabled={accepting || declining}
        >
          {declining ? (
            <ActivityIndicator color="#E74C3C" />
          ) : (
            <Text style={styles.declineButtonText}>Decline</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Invitation expires on {invitation.expiresAt.toLocaleDateString()}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F23',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1F1F3F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorIconText: {
    fontSize: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F87171',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#0F0F23',
  },
  inviteIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1F1F3F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  inviteIconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
  invitationCard: {
    backgroundColor: '#1A1A2E',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F1F3F',
  },
  householdInfo: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F3F',
  },
  householdName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  inviterInfo: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  roleInfo: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  detailsText: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
    marginBottom: 16,
  },
  featureList: {
    gap: 8,
  },
  featureItem: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
  },
  adminNotice: {
    backgroundColor: '#1F2336',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  adminNoticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FDE68A',
    marginBottom: 4,
  },
  adminNoticeText: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 18,
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  acceptButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#1F1F3F',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  declineButtonText: {
    color: '#F87171',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: {
    alignItems: 'center',
    padding: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});