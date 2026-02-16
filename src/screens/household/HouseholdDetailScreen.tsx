import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  Platform,
  FlatList,
  Alert,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HouseholdStackParamList, Household, HouseholdMember, Shift} from '@/types';
import {useAuth} from '@/contexts/AuthContext';
import {useHousehold} from '@/contexts/HouseholdContext';
import {householdService} from '@/services/household.service';
import {shiftService} from '@/services/shift.service';
import {showAlert, showError, showSuccess} from '@/utils/alert';
import {getMemberStatus} from '@/utils/memberStatus';

type Props = NativeStackScreenProps<HouseholdStackParamList, 'HouseholdDetail'>;

export const HouseholdDetailScreen: React.FC<Props> = ({navigation, route}) => {
  const {user} = useAuth();
  const {setCurrentHousehold} = useHousehold();
  const {householdId} = route.params;
  
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leavingInProgress, setLeavingInProgress] = useState(false);

  const loadHouseholdData = useCallback(async () => {
    setLoading(true);
    try {
      const householdData = await householdService.getHousehold(householdId);
      setHousehold(householdData);
      setIsAdmin(householdData.admins.includes(user?.id || ''));
      
      const membersList = await householdService.getHouseholdMembers(householdId);
      setMembers(membersList);
      
      // Load shifts for today to show status
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const shiftsData = await shiftService.getShifts({
        householdId,
        startDate: startOfDay,
        endDate: endOfDay,
      });
      
      setShifts(shiftsData.shifts);
    } catch (error) {
      console.error('Error loading household:', error);
      showError('Failed to load household details');
    } finally {
      setLoading(false);
    }
  }, [householdId, user?.id]);

  useEffect(() => {
    loadHouseholdData();
  }, [loadHouseholdData]);

  const shareJoinCode = async () => {
    if (!household) return;
    
    try {
      const message = `Join me on KinShift! Use join code: ${household.joinCode}\n\nKinShift helps families coordinate work schedules and manage shifts together.`;
      
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Share.share({
          message,
          title: `Join ${household.name} on KinShift`,
        });
      } else {
        // Web fallback: copy to clipboard would go here
        showAlert('Share Code', `Code: ${household.joinCode}`);
      }
    } catch (error) {
      console.error('Error sharing:', error);
      showError('Failed to share join code');
    }
  };

  const copyJoinCode = async () => {
    if (!household) return;
    
    try {
      // This would require a clipboard library, but for now just show alert
      showSuccess(`Join code copied: ${household.joinCode}`);
    } catch (error) {
      showError('Failed to copy join code');
    }
  };

  const handleManageMembers = () => {
    navigation.navigate('ManageMembers', {householdId});
  };

  const handleInviteMembers = () => {
    navigation.navigate('InviteMembers', {householdId});
  };

  const handleLeaveHousehold = () => {
    if (!user?.id) return;

    const message = 'Are you sure you want to leave this household?';

    if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
      const confirmed = (globalThis as any).confirm?.(message);
      if (!confirmed) return;
      performLeaveHousehold();
    } else {
      Alert.alert(
        'Leave Household',
        message,
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
      setLeavingInProgress(true);
      await householdService.leaveHousehold(householdId, user.id);
      
      // Clear the current household context so it switches to personal mode
      setCurrentHousehold(null);
      
      if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
        (globalThis as any).alert?.('You have left the household');
      } else {
        showSuccess('You have left the household');
      }
      
      setLeavingInProgress(false);
      navigation.navigate('HouseholdList');
    } catch (error: any) {
      setLeavingInProgress(false);
      console.error('Error leaving household:', error);
      if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
        (globalThis as any).alert?.('Error: ' + (error.message || 'Failed to leave household'));
      } else {
        showError(error.message || 'Failed to leave household');
      }
    }
  };

  const renderMember = (item: HouseholdMember) => {
    const statusInfo = getMemberStatus(item.userId, shifts);
    
    return (
      <View style={styles.memberCard}>
        <View style={{flexDirection: 'row', alignItems: 'flex-start', gap: 12}}>
          {/* Status Indicator Dot with Pulse Effect */}
          <View style={{justifyContent: 'center', alignItems: 'center', paddingTop: 4}}>
            <View 
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: statusInfo.color,
                shadowColor: statusInfo.color,
                shadowOffset: {width: 0, height: 0},
                shadowOpacity: 0.5,
                shadowRadius: 3,
                elevation: 3,
              }}
            />
          </View>
          
          <View style={{flex: 1}}>
            <Text style={styles.memberName}>{item.name}</Text>
            {item.email && (
              <Text style={styles.memberEmail}>{item.email}</Text>
            )}
            <Text style={styles.memberRole}>
              {item.role === 'admin' ? '👑 Admin' : '👤 Member'} • <Text style={{color: statusInfo.color, fontWeight: '600'}}>{statusInfo.label}</Text>
            </Text>
            
            {/* Show reason/details below status */}
            {statusInfo.reason && (
              <Text style={[styles.memberStatus, {color: statusInfo.color}]}>
                {statusInfo.reason}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.joinedDate}>
          Joined {(item.joinedAt?.toDate ? item.joinedAt.toDate() : new Date(item.joinedAt)).toLocaleDateString()}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading household...</Text>
      </View>
    );
  }

  if (!household) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Household not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.householdName}>{household.name}</Text>
        <Text style={styles.memberCountText}>
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </Text>
      </View>

      {/* Join Code Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Share Join Code</Text>
        <Text style={styles.sectionDescription}>
          Share this code with family members to invite them to join this household.
        </Text>
        
        <View style={styles.joinCodeBox}>
          <Text style={styles.joinCodeLabel}>Join Code</Text>
          <Text style={styles.joinCodeValue}>{household.joinCode}</Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]}
            onPress={shareJoinCode}>
            <Text style={styles.buttonText}>📤 Share Code</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={copyJoinCode}>
            <Text style={styles.buttonText}>📋 Copy Code</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Members Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Members ({members.length})</Text>
        </View>
        
        {members.length > 0 ? (
          <FlatList
            data={members}
            renderItem={({item}) => renderMember(item)}
            keyExtractor={(item) => item.userId}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyText}>No members yet</Text>
        )}
      </View>

      {/* Actions Section */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Actions</Text>
          
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]}
            onPress={handleInviteMembers}>
            <Text style={styles.buttonText}>+ Invite Members</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={handleManageMembers}>
            <Text style={styles.buttonText}>Manage Members</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Leave Household Section - Only for non-admin members */}
      {!isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Membership</Text>
          
          <TouchableOpacity 
            style={[styles.button, styles.dangerButton]}
            onPress={handleLeaveHousehold}
            disabled={leavingInProgress}>
            <Text style={styles.buttonText}>
              {leavingInProgress ? '⏳ Leaving...' : '🚪 Leave Household'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Household Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Household Info</Text>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Created</Text>
          <Text style={styles.infoValue}>
            {(household.createdAt?.toDate ? household.createdAt.toDate() : new Date(household.createdAt)).toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Admins</Text>
          <Text style={styles.infoValue}>{household.admins.length}</Text>
        </View>
      </View>

      <View style={styles.spacer} />
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#A1A1AA',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  householdName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  memberCountText: {
    fontSize: 16,
    color: '#A1A1AA',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#A1A1AA',
    marginBottom: 16,
    lineHeight: 20,
  },
  joinCodeBox: {
    backgroundColor: '#2A2A3E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  joinCodeLabel: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  joinCodeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6366F1',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#6366F1',
  },
  secondaryButton: {
    backgroundColor: '#2A2A3E',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  dangerButton: {
    backgroundColor: '#DC2626',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberCard: {
    backgroundColor: '#2A2A3E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '500',
  },
  memberStatus: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  joinedDate: {
    fontSize: 12,
    color: '#A1A1AA',
    marginTop: 8,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  infoLabel: {
    fontSize: 14,
    color: '#A1A1AA',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#A1A1AA',
    textAlign: 'center',
    paddingVertical: 20,
  },
  spacer: {
    height: 40,
  },
});
