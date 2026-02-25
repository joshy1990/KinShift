import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CalendarStackParamList, Shift, HouseholdMember} from '@/types';
import {shiftService} from '@/services/shift.service';
import {householdService} from '@/services/household.service';
import {notificationService} from '@/services/notification.service';
import {useAuth} from '@/contexts/AuthContext';
import {RoleBadge} from '@/components/RoleBadge';
import {showAlert, showError, showConfirm} from '@/utils/alert';

type Props = NativeStackScreenProps<CalendarStackParamList, 'ShiftDetail'>;

export const ShiftDetailScreen: React.FC<Props> = ({route, navigation}) => {
  const {shiftId} = route.params;
  const {user} = useAuth();
  
  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftOwner, setShiftOwner] = useState<HouseholdMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadShiftAndPermissions = async () => {
      try {
        setLoading(true);
        
        // Load shift data
        const shiftData = await shiftService.getShift(shiftId);
        if (!shiftData) {
          showError('Shift not found');
          navigation.goBack();
          return;
        }
        setShift(shiftData);

        // Only check admin status if shift has a household
        if (shiftData.householdId) {
          // Check if user is admin of the household
          const adminCheck = await householdService.isHouseholdAdmin(
            shiftData.householdId,
            user.id
          );
          setIsAdmin(adminCheck);

          // Load shift owner info
          if (shiftData.ownerId) {
            const members = await householdService.getHouseholdMembers(
              shiftData.householdId
            );
            const owner = members.find(m => m.userId === shiftData.ownerId);
            if (owner) {
              setShiftOwner(owner);
            }
          }
        } else {
          // Personal shift - user is always admin of their own shifts
          setIsAdmin(user.id === shiftData.ownerId);
        }
      } catch (error) {
        console.error('Error loading shift:', error);
        showError('Failed to load shift details');
      } finally {
        setLoading(false);
      }
    };

    loadShiftAndPermissions();
  }, [shiftId, user, navigation]);

  const canEdit = () => {
    if (!user || !shift) return false;
    // Only the shift owner can edit their own shift
    return shift.ownerId === user.id;
  };

  const canDelete = () => {
    if (!user || !shift) return false;
    // Only the shift owner can delete their own shift
    return shift.ownerId === user.id;
  };

  const handleEdit = () => {
    if (!canEdit()) {
      showAlert(
        'Permission Denied',
        'You can only edit your own shifts'
      );
      return;
    }
    navigation.navigate('EditShift', {shiftId});
  };

  const handleDelete = async () => {
    if (!canDelete()) {
      showAlert(
        'Permission Denied',
        'You can only delete your own shifts'
      );
      return;
    }

    showConfirm(
      'Delete Shift',
      'Are you sure you want to delete this shift?',
      async () => {
        try {
          if (shift && user) {
            await shiftService.deleteShift(shiftId, user.id);
            
            // Send deletion notification to household members
            if (shift.householdId) {
              try {
                await notificationService.notifyShiftDeleted({
                  householdId: shift.householdId,
                  shift,
                  deleterId: user.id,
                  deleterName: user.name || 'Someone',
                });
              } catch (notificationError) {
                console.warn('Failed to send shift deletion notification:', notificationError);
              }
            }
            
            navigation.goBack();
            showAlert('Success', 'Shift deleted successfully');
          }
        } catch (error) {
          console.error('Error deleting shift:', error);
          showError('Failed to delete shift');
        }
      }
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!shift) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Shift not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = user && shift.ownerId === user.id;

  // Convert Firestore Timestamps to Date objects
  const toDate = (val: any): Date => {
    if (val?.toDate) return val.toDate();
    if (val && typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
    return new Date(val);
  };
  const shiftStartDate = toDate(shift.startTime);
  const shiftEndDate = toDate(shift.endTime);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{shift.title}</Text>
        {shift.notes && (
          <Text style={styles.description}>{shift.notes}</Text>
        )}
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📅</Text>
          <Text style={styles.infoLabel}>Date</Text>
        </View>
        <Text style={styles.infoValue}>
          {shiftStartDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>⏰</Text>
          <Text style={styles.infoLabel}>Time</Text>
        </View>
        <Text style={styles.infoValue}>
          {shiftStartDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
          {' - '}
          {shiftEndDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>

      {shift.colorTag && (
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🎨</Text>
            <Text style={styles.infoLabel}>Color</Text>
          </View>
          <View style={styles.colorPreview}>
            <View style={[styles.colorSwatch, {backgroundColor: shift.colorTag}]} />
            <Text style={styles.infoValue}>{shift.colorTag}</Text>
          </View>
        </View>
      )}

      {shiftOwner && (
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>👤</Text>
            <Text style={styles.infoLabel}>Shift Owner</Text>
          </View>
          <View style={styles.ownerInfo}>
            <View style={styles.ownerDetails}>
              <Text style={styles.ownerName}>
                {shiftOwner.name}
                {isOwner && ' (You)'}
              </Text>
              {shiftOwner.email && (
                <Text style={styles.ownerEmail}>{shiftOwner.email}</Text>
              )}
            </View>
            <RoleBadge role={shiftOwner.role} size="small" />
          </View>
        </View>
      )}

      {shift.recurringRule && (
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🔁</Text>
            <Text style={styles.infoLabel}>Recurring Pattern</Text>
          </View>
          <Text style={styles.infoValue}>
            {shift.recurringRule.frequency === 'weekly' && `Every ${shift.recurringRule.interval > 1 ? shift.recurringRule.interval + ' ' : ''}week(s)`}
            {shift.recurringRule.frequency === 'biweekly' && 'Every two weeks'}
            {shift.recurringRule.frequency === 'monthly' && `Every ${shift.recurringRule.interval > 1 ? shift.recurringRule.interval + ' ' : ''}month(s)`}
            {shift.recurringRule.frequency === 'daily' && `Every ${shift.recurringRule.interval > 1 ? shift.recurringRule.interval + ' ' : ''}day(s)`}
          </Text>
          {shift.recurringRule.endDate && (
            <Text style={styles.infoSubtext}>
              Ends on {new Date(shift.recurringRule.endDate).toLocaleDateString()}
            </Text>
          )}
        </View>
      )}

      <View style={styles.permissionInfo}>
        <Text style={styles.permissionIcon}>
          {canEdit() ? '✅' : '🔒'}
        </Text>
        <Text style={styles.permissionText}>
          {canEdit()
            ? 'You have permission to edit this shift'
            : 'Only the shift owner or household admins can edit this shift'}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.editButton,
            !canEdit() && styles.disabledButton,
          ]}
          onPress={handleEdit}
          disabled={!canEdit()}>
          <Text style={styles.editButtonText}>✏️ Edit Shift</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.deleteButton,
            !canDelete() && styles.disabledButton,
          ]}
          onPress={handleDelete}
          disabled={!canDelete()}>
          <Text style={styles.deleteButtonText}>🗑️ Delete Shift</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F23',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F23',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 20,
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
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F3A',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#9CA3AF',
    lineHeight: 24,
  },
  infoCard: {
    backgroundColor: '#1F1F3A',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginLeft: 0,
  },
  infoValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  infoSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  ownerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ownerDetails: {
    flex: 1,
    marginRight: 12,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  ownerEmail: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1F1F3A',
    borderRadius: 8,
  },
  permissionIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  permissionText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 0,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 32,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
