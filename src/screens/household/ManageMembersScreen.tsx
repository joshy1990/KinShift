import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HouseholdStackParamList} from '@/types';
import {householdService} from '@/services/household.service';
import {useAuth} from '@/contexts/AuthContext';
import {HouseholdMember} from '@/types';

type Props = NativeStackScreenProps<HouseholdStackParamList, 'ManageMembers'>;

export const ManageMembersScreen: React.FC<Props> = ({route, navigation}) => {
  const {householdId} = route.params;
  const {user} = useAuth();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      const householdMembers = await householdService.getHouseholdMembers(householdId);
      setMembers(householdMembers);

      if (user?.id) {
        const adminStatus = await householdService.isHouseholdAdmin(householdId, user.id);
        setIsAdmin(adminStatus);
      }
    } catch (error) {
      console.error('❌ Error loading members:', error);
      if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
        (globalThis as any).alert?.('Failed to load household members');
      } else {
        Alert.alert('Error', 'Failed to load household members');
      }
    } finally {
      setLoading(false);
    }
  }, [householdId, user?.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRemoveMember = (member: HouseholdMember) => {
    if (!user?.id) return;

    const message = `Are you sure you want to remove ${member.name} from the household?${
      member.role === 'admin' ? '\n\nThe second member to join will be promoted to admin.' : ''
    }`;

    if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
      const confirmed = (globalThis as any).confirm?.(message);
      if (!confirmed) return;
      performRemoveMember(member);
    } else {
      Alert.alert(
        'Remove Member',
        message,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => performRemoveMember(member),
          },
        ]
      );
    }
  };

  const performRemoveMember = async (member: HouseholdMember) => {
    if (!user?.id) return;
    
    try {
      setActionInProgress(member.userId);
      await householdService.removeMember(householdId, member.userId, user.id);
      if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
        (globalThis as any).alert?.(`${member.name} has been removed from the household`);
      } else {
        Alert.alert('Success', `${member.name} has been removed from the household`);
      }
      await loadMembers();
    } catch (error: any) {
      console.error('Error removing member:', error);
      if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
        (globalThis as any).alert?.('Error: ' + (error.message || 'Failed to remove member'));
      } else {
        Alert.alert('Error', error.message || 'Failed to remove member');
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const handleLeaveHousehold = () => {
    if (!user?.id) {
      console.error('User ID is missing, cannot leave household');
      return;
    }

    // On web platform, use window.confirm instead of Alert.alert
    if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
      const confirmed = (globalThis as any).confirm?.('Are you sure you want to leave this household?');
      if (!confirmed) {
        return;
      }
      performLeaveHousehold();
    } else {
      // On native platforms, use Alert.alert
      Alert.alert(
        'Leave Household',
        'Are you sure you want to leave this household?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Leave',
            style: 'destructive',
            onPress: performLeaveHousehold,
          },
        ]
      );
    }
  };

  const performLeaveHousehold = async () => {
    if (!user?.id) return;
    
    try {
      setActionInProgress('leave');
      await householdService.leaveHousehold(householdId, user.id);
      
      // On web, use alert for success, then navigate
      if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
        (globalThis as any).alert?.('You have left the household');
        setActionInProgress(null);
        navigation.navigate('HouseholdList' as never);
      } else {
        // On native, use Alert.alert
        Alert.alert('Success', 'You have left the household', [
          {
            text: 'OK',
            onPress: () => {
              setActionInProgress(null);
              navigation.navigate('HouseholdList');
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error('❌ Error leaving household:', error);
      if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
        (globalThis as any).alert?.('Error: ' + (error.message || 'Failed to leave household'));
      } else {
        Alert.alert('Error', error.message || 'Failed to leave household');
      }
      setActionInProgress(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Household Members ({members.length})</Text>

        <FlatList
          scrollEnabled={false}
          data={members}
          keyExtractor={item => item.userId}
          renderItem={({item}) => (
            <View style={styles.memberCard}>
              <View style={styles.memberInfo}>
                <View>
                  <Text style={styles.memberName}>{item.name}</Text>
                  <Text style={styles.memberEmail}>{item.email || 'No email'}</Text>
                </View>
                <View style={[styles.roleBadge, item.role === 'admin' ? styles.roleBadgeAdmin : null]}>
                  <Text style={styles.roleBadgeText}>{item.role.toUpperCase()}</Text>
                </View>
              </View>

              {/* Admin can remove other members */}
              {isAdmin && item.userId !== user?.id && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveMember(item)}
                  disabled={actionInProgress === item.userId}>
                  {actionInProgress === item.userId ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Text style={styles.removeButtonText}>Remove</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Current user can leave */}
              {item.userId === user?.id && (
                <TouchableOpacity
                  style={[styles.removeButton, styles.leaveButton]}
                  onPress={handleLeaveHousehold}
                  disabled={actionInProgress === 'leave'}
                  activeOpacity={0.6}>
                  {actionInProgress === 'leave' ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Text style={styles.removeButtonText}>Leave</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>ℹ️ Member Management</Text>
        <Text style={styles.infoText}>
          • <Text style={styles.infoBold}>Admins</Text> can remove members from the household
        </Text>
        <Text style={styles.infoText}>
          • Any member can leave the household anytime
        </Text>
        <Text style={styles.infoText}>
          • If an admin leaves, the second person to join automatically becomes admin
        </Text>
        <Text style={styles.infoText}>
          • If you're the last member, leaving will delete the household
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0F23',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  roleBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 12,
  },
  roleBadgeAdmin: {
    backgroundColor: '#F59E0B',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  removeButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  leaveButton: {
    backgroundColor: '#DC2626',
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoSection: {
    backgroundColor: '#1A1A2E',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#06B6D4',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#D1D5DB',
    marginBottom: 8,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
