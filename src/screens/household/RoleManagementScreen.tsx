import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {householdService} from '../../services/household.service';
import {HouseholdMember, HouseholdStackParamList} from '../../types';
import {useAuth} from '../../contexts/AuthContext';
import {RoleBadge} from '../../components/RoleBadge';
import {showAlert, showError, showSuccess, showConfirm} from '@/utils/alert';

type RoleManagementScreenProps = NativeStackScreenProps<
  HouseholdStackParamList,
  'RoleManagement'
>;

export const RoleManagementScreen: React.FC<RoleManagementScreenProps> = ({
  navigation,
  route,
}) => {
  const {householdId, householdName} = route.params;
  const {user} = useAuth();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
    checkAdminStatus();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const householdMembers = await householdService.getHouseholdMembers(householdId);
      setMembers(householdMembers);
    } catch (error) {
      console.error('Error loading members:', error);
      showError('Failed to load household members');
    } finally {
      setLoading(false);
    }
  };

  const checkAdminStatus = async () => {
    if (!user?.id) return;
    const adminStatus = await householdService.isHouseholdAdmin(householdId, user.id);
    setIsAdmin(adminStatus);
  };

  const handlePromoteMember = async (member: HouseholdMember) => {
    if (!user?.id) return;

    showConfirm(
      'Promote to Admin',
      `Are you sure you want to promote ${member.name} to admin? They will have full control over the household.`,
      async () => {
        setProcessing(member.userId);
        try {
          // TODO: Implement promoteMemberToAdmin in householdService
          // await householdService.promoteMemberToAdmin(
          //   householdId,
          //   user.id,
          //   member.userId
          // );
          showError('Role promotion not yet implemented');
          // showSuccess(`${member.name} is now an admin`);
          // await loadMembers();
        } catch (error: any) {
          showError(error.message || 'Failed to promote member');
        } finally {
          setProcessing(null);
        }
      }
    );
  };

  const handleDemoteMember = async (member: HouseholdMember) => {
    if (!user?.id) return;

    showConfirm(
      'Demote to Member',
      `Are you sure you want to demote ${member.name} to regular member? They will lose admin privileges.`,
      async () => {
        setProcessing(member.userId);
        try {
          // TODO: Implement demoteAdminToMember in householdService
          // await householdService.demoteAdminToMember(
          //   householdId,
          //   user.id,
          //   member.userId
          // );
          showError('Role demotion not yet implemented');
          // showSuccess(`${member.name} is now a regular member`);
          // await loadMembers();
        } catch (error: any) {
          showError(error.message || 'Failed to demote admin');
        } finally {
          setProcessing(null);
        }
      }
    );
  };

  const handleTransferOwnership = async (member: HouseholdMember) => {
    if (!user?.id) return;

    showConfirm(
      'Transfer Ownership',
      `Are you sure you want to transfer ownership to ${member.name}? They will become the primary admin of ${householdName}.`,
      async () => {
        setProcessing(member.userId);
        try {
          await householdService.transferOwnership(
            householdId,
            user.id,
            member.userId
          );
          showAlert(
            'Ownership Transferred',
            `${member.name} is now the owner of ${householdName}.`
          );
          await loadMembers();
          await checkAdminStatus();
        } catch (error: any) {
          showError(error.message || 'Failed to transfer ownership');
        } finally {
          setProcessing(null);
        }
      }
    );
  };

  const handleRemoveMember = async (member: HouseholdMember) => {
    if (!user?.id) return;

    showConfirm(
      'Remove Member',
      `Are you sure you want to remove ${member.name} from ${householdName}? They will lose access to all shifts and data.`,
      async () => {
        setProcessing(member.userId);
        try {
          const canRemove = await householdService.canRemoveMember(
            householdId,
            user.id,
            member.userId
          );
          
          if (!canRemove.allowed) {
            showAlert('Cannot Remove', canRemove.reason);
            setProcessing(null);
            return;
          }

          await householdService.removeMember(householdId, member.userId, user.id);
          showSuccess(`${member.name} has been removed`);
          await loadMembers();
        } catch (error: any) {
          showError(error.message || 'Failed to remove member');
        } finally {
          setProcessing(null);
        }
      }
    );
  };

  const renderRoleBadge = (member: HouseholdMember) => {
    return <RoleBadge role={member.role} size="small" />;
  };

  const isOwner = (member: HouseholdMember) => {
    // First admin in list is the owner
    return members[0]?.userId === member.userId && member.role === 'admin';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>🔒</Text>
        <Text style={styles.errorTitle}>Admin Access Required</Text>
        <Text style={styles.errorText}>
          Only admins can manage household roles
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{householdName}</Text>
        <Text style={styles.subtitle}>Manage member roles and permissions</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Role Permissions</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>👑</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Admin</Text>
            <Text style={styles.infoDescription}>
              Full control: Invite/remove members, manage roles, edit settings
            </Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>👤</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Member</Text>
            <Text style={styles.infoDescription}>
              Manage own shifts, view household calendar, add notes
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.membersSection}>
        <Text style={styles.sectionTitle}>
          Members ({members.length})
        </Text>

        {members.map(member => {
          const isCurrentUser = user?.id === member.userId;
          const isMemberOwner = isOwner(member);
          const isProcessing = processing === member.userId;

          return (
            <View key={member.userId} style={styles.memberCard}>
              <View style={styles.memberInfo}>
                <View style={styles.memberHeader}>
                  <Text style={styles.memberName}>
                    {member.name}
                    {isCurrentUser && ' (You)'}
                  </Text>
                  {isMemberOwner && (
                    <View style={styles.ownerBadge}>
                      <Text style={styles.ownerBadgeText}>OWNER</Text>
                    </View>
                  )}
                </View>
                {member.email && (
                  <Text style={styles.memberEmail}>{member.email}</Text>
                )}
                <View style={styles.memberMeta}>
                  {renderRoleBadge(member)}
                  <Text style={styles.memberJoined}>
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              {!isCurrentUser && !isProcessing && (
                <View style={styles.memberActions}>
                  {member.role === 'member' ? (
                    <TouchableOpacity
                      style={styles.promoteButton}
                      onPress={() => handlePromoteMember(member)}>
                      <Text style={styles.promoteButtonText}>Promote</Text>
                    </TouchableOpacity>
                  ) : (
                    !isMemberOwner && (
                      <TouchableOpacity
                        style={styles.demoteButton}
                        onPress={() => handleDemoteMember(member)}>
                        <Text style={styles.demoteButtonText}>Demote</Text>
                      </TouchableOpacity>
                    )
                  )}

                  {member.role === 'member' && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveMember(member)}>
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  )}

                  {member.role === 'admin' && !isMemberOwner && (
                    <TouchableOpacity
                      style={styles.transferButton}
                      onPress={() => handleTransferOwnership(member)}>
                      <Text style={styles.transferButtonText}>Transfer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {isProcessing && (
                <ActivityIndicator size="small" color="#6366F1" />
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0F23',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0F0F23',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 20,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  infoCard: {
    backgroundColor: '#1A1A2E',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  infoDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  membersSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  memberCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginRight: 12,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 8,
  },
  memberEmail: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberJoined: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 12,
  },
  ownerBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  memberActions: {
    flexDirection: 'column',
    gap: 8,
  },
  promoteButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 90,
  },
  promoteButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  demoteButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 90,
  },
  demoteButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  removeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 90,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    textAlign: 'center',
  },
  transferButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 90,
  },
  transferButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
