import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useAuth} from '@/contexts/AuthContext';
import {notificationService} from '@/services/notification.service';
import {db, COLLECTIONS} from '@/config/firebase.config';
import {doc, getDoc, setDoc} from '@/config/firestore.compat';
import {showError, showSuccess, showAlert} from '@/utils/alert';

type RootStackParamList = {
  NotificationPreferences: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationPreferences'>;

interface NotificationPreferences {
  pushNotifications: boolean;
  shiftCreated: boolean;
  shiftUpdated: boolean;
  shiftReminders: boolean;
  invitations: boolean;
  conflicts: boolean;
  reminderMinutes: number;
  quietHoursEnabled: boolean;
  quietStart: string; // "22:00"
  quietEnd: string; // "07:00"
}

const defaultPreferences: NotificationPreferences = {
  pushNotifications: true,
  shiftCreated: true,
  shiftUpdated: true,
  shiftReminders: true,
  invitations: true,
  conflicts: true,
  reminderMinutes: 60,
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '07:00',
};

const reminderOptions = [
  {label: '15 minutes before', value: 15},
  {label: '30 minutes before', value: 30},
  {label: '1 hour before', value: 60},
  {label: '2 hours before', value: 120},
  {label: '1 day before', value: 1440},
];

export const NotificationPreferencesScreen: React.FC<Props> = ({navigation}) => {
  const {user} = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<string>('checking');

  useEffect(() => {
    loadPreferences();
    checkPermissionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPreferences = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Load from Firestore user document
      const userDocRef = doc(db, COLLECTIONS.USERS, user.id);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.notificationPreferences) {
          setPreferences({
            ...defaultPreferences,
            ...userData.notificationPreferences,
          });
        } else {
          // No preferences saved yet, use defaults
          setPreferences(defaultPreferences);
        }
      } else {
        // User document doesn't exist, use defaults
        setPreferences(defaultPreferences);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      showError('Failed to load notification preferences');
      setPreferences(defaultPreferences);
    } finally {
      setLoading(false);
    }
  };

  const checkPermissionStatus = async () => {
    const status = await notificationService.checkPermission();
    setPermissionStatus(status);
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    if (!user?.id) {
      showError('User not authenticated');
      return;
    }

    try {
      // Save to Firestore user document
      const userDocRef = doc(db, COLLECTIONS.USERS, user.id);
      await setDoc(userDocRef, {
        notificationPreferences: newPreferences,
        updatedAt: new Date(),
      }, { merge: true }); // merge: true ensures we don't overwrite other user data
      
      setPreferences(newPreferences);
    } catch (error) {
      console.error('Error saving preferences:', error);
      showError('Failed to save notification preferences');
    }
  };

  const handleToggle = (key: keyof NotificationPreferences, value: boolean | number | string) => {
    const newPreferences = {...preferences, [key]: value};
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const handleEnableNotifications = async () => {
    if (permissionStatus === 'denied') {
      showAlert(
        'Notifications Disabled',
        'Notifications are disabled in device settings. Please enable them in Settings > KinShift > Notifications.'
      );
      return;
    }

    const granted = await notificationService.requestPermission();
    if (granted && user) {
      await notificationService.initialize(user.id);
      await checkPermissionStatus();
      handleToggle('pushNotifications', true);
    } else {
      handleToggle('pushNotifications', false);
    }
  };

  const renderToggleRow = (
    title: string,
    description: string,
    key: keyof NotificationPreferences,
    disabled = false
  ) => (
    <View style={[styles.row, disabled && styles.disabledRow]}>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, disabled && styles.disabledText]}>{title}</Text>
        <Text style={[styles.rowDescription, disabled && styles.disabledText]}>
          {description}
        </Text>
      </View>
      <Switch
        value={preferences[key] as boolean}
        onValueChange={(value) => handleToggle(key, value)}
        disabled={disabled || !preferences.pushNotifications}
        trackColor={{ false: '#374151', true: '#6366F1' }}
        thumbColor={'#FFFFFF'}
      />
    </View>
  );

  const renderReminderRow = () => (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>Shift Reminder Timing</Text>
        <Text style={styles.rowDescription}>When to receive shift reminders</Text>
      </View>
      <View style={styles.reminderOptions}>
        {reminderOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.reminderOption,
              preferences.reminderMinutes === option.value && styles.selectedOption,
            ]}
            onPress={() => handleToggle('reminderMinutes', option.value)}
            disabled={!preferences.pushNotifications || !preferences.shiftReminders}
          >
            <Text
              style={[
                styles.optionText,
                preferences.reminderMinutes === option.value && styles.selectedOptionText,
                (!preferences.pushNotifications || !preferences.shiftReminders) && styles.disabledText,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPermissionStatus = () => {
    let statusText = '';
    let statusColor = '';
    
    switch (permissionStatus) {
      case 'authorized':
        statusText = 'Notifications Enabled';
        statusColor = '#27AE60';
        break;
      case 'denied':
        statusText = 'Notifications Disabled';
        statusColor = '#E74C3C';
        break;
      case 'not-determined':
      case 'provisional':
        statusText = 'Notifications Available';
        statusColor = '#F39C12';
        break;
      default:
        statusText = 'Checking...';
        statusColor = '#95A5A6';
    }

    return (
      <View style={[styles.statusCard, {borderColor: statusColor}]}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusIndicator, {backgroundColor: statusColor}]} />
          <Text style={[styles.statusTitle, {color: statusColor}]}>{statusText}</Text>
        </View>
        
        {permissionStatus !== 'authorized' && (
          <TouchableOpacity 
            style={styles.enableButton}
            onPress={handleEnableNotifications}
          >
            <Text style={styles.enableButtonText}>Enable Notifications</Text>
          </TouchableOpacity>
        )}
        
        <Text style={styles.statusDescription}>
          {permissionStatus === 'authorized' 
            ? 'You\'ll receive notifications for shift updates, invitations, and reminders.'
            : 'Enable notifications to stay updated on schedule changes and receive important reminders.'
          }
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push Notifications</Text>
        {renderPermissionStatus()}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Types</Text>
        <View style={styles.card}>
          {renderToggleRow(
            'Shift Changes',
            'When shifts are created, edited, or deleted',
            'shiftCreated'
          )}
          {renderToggleRow(
            'Shift Updates',
            'When existing shifts are modified',
            'shiftUpdated'
          )}
          {renderToggleRow(
            'Shift Reminders',
            'Reminders before your shifts start',
            'shiftReminders'
          )}
          {renderToggleRow(
            'Invitations',
            'When you\'re invited to join a household',
            'invitations'
          )}
          {renderToggleRow(
            'Conflict Alerts',
            'When scheduling conflicts are detected',
            'conflicts'
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reminder Settings</Text>
        <View style={styles.card}>
          {renderReminderRow()}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quiet Hours</Text>
        <View style={styles.card}>
          {renderToggleRow(
            'Enable Quiet Hours',
            'Pause notifications during specified hours',
            'quietHoursEnabled'
          )}
          
          {preferences.quietHoursEnabled && (
            <View style={styles.quietHoursSettings}>
              <Text style={styles.quietHoursLabel}>
                Quiet hours: {preferences.quietStart} - {preferences.quietEnd}
              </Text>
              <Text style={styles.quietHoursNote}>
                (Time picker would be implemented here in a full app)
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#9CA3AF',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1A1A2E',
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F1F3F',
  },
  statusCard: {
    backgroundColor: '#1A1A2E',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  enableButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 8,
    alignSelf: 'flex-start',
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F3F',
  },
  disabledRow: {
    opacity: 0.5,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 2,
  },
  rowDescription: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  disabledText: {
    color: '#6B7280',
  },
  reminderOptions: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
  },
  reminderOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#0F0F23',
  },
  selectedOption: {
    borderColor: '#6366F1',
    backgroundColor: '#1F2336',
  },
  optionText: {
    fontSize: 14,
    color: '#E5E7EB',
    textAlign: 'center',
  },
  selectedOptionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  quietHoursSettings: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1F1F3F',
  },
  quietHoursLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 4,
  },
  quietHoursNote: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});