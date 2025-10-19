import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HouseholdStackParamList} from '@/types';
import {useAuth} from '@/contexts/AuthContext';
import {useHousehold} from '@/contexts/HouseholdContext';
import {showAlert, showError, showSuccess} from '@/utils/alert';

type Props = NativeStackScreenProps<HouseholdStackParamList, 'CreateHousehold'>;

interface FormData {
  name: string;
  allowMemberEditOthers: boolean;
  requireApprovalForShifts: boolean;
  notifyOnConflicts: boolean;
}

export const CreateHouseholdScreen: React.FC<Props> = ({navigation}) => {
  const {user} = useAuth();
  const {createHousehold} = useHousehold();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormData>({
    name: '',
    allowMemberEditOthers: false,
    requireApprovalForShifts: false,
    notifyOnConflicts: true,
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Household name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Household name must be at least 3 characters';
    } else if (formData.name.trim().length > 50) {
      newErrors.name = 'Household name must be less than 50 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user) {
      showError('You must be logged in to create a household');
      return;
    }

    setLoading(true);
    try {
      const household = await createHousehold(
        formData.name.trim(),
        {
          allowMemberEditOthers: formData.allowMemberEditOthers,
          requireApprovalForShifts: formData.requireApprovalForShifts,
          notifyOnConflicts: formData.notifyOnConflicts,
        }
      );

      console.log('Household created successfully:', household);

      // Show success message with join code
      showAlert(
        'Success!',
        `Household "${household.name}" created!\n\nJoin Code: ${household.joinCode}\n\nShare this code with family members.`
      );
      
      navigation.navigate('HouseholdDetail', {householdId: household.id});
    } catch (error: any) {
      console.error('Failed to create household:', error);
      showError('Failed to create household: ' + (error.message || 'Please try again'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Create New Household</Text>
          <Text style={styles.subtitle}>
            Create a shared space for your family to coordinate schedules
          </Text>
        </View>

      <View style={styles.form}>
        {/* Household Name */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Household Name *</Text>
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : null]}
            value={formData.name}
            onChangeText={(text) => {
              setFormData({...formData, name: text});
              if (errors.name) {
                setErrors({...errors, name: ''});
              }
            }}
            placeholder="Enter household name (e.g., 'The Smith Family')"
            maxLength={50}
            autoCapitalize="words"
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          <Text style={styles.characterCount}>{formData.name.length}/50</Text>
        </View>

        {/* Settings */}
        <View style={styles.settingsContainer}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Allow members to edit others' shifts</Text>
              <Text style={styles.settingDescription}>
                Members can modify shifts created by other family members
              </Text>
            </View>
            <Switch
              value={formData.allowMemberEditOthers}
              onValueChange={(value) =>
                setFormData({...formData, allowMemberEditOthers: value})
              }
              trackColor={{false: '#3F3F46', true: '#06B6D4'}}
              thumbColor={formData.allowMemberEditOthers ? '#FFFFFF' : '#A1A1AA'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Require approval for new shifts</Text>
              <Text style={styles.settingDescription}>
                Admin must approve shifts before they're added to the calendar
              </Text>
            </View>
            <Switch
              value={formData.requireApprovalForShifts}
              onValueChange={(value) =>
                setFormData({...formData, requireApprovalForShifts: value})
              }
              trackColor={{false: '#3F3F46', true: '#06B6D4'}}
              thumbColor={formData.requireApprovalForShifts ? '#FFFFFF' : '#A1A1AA'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Notify on conflicts</Text>
              <Text style={styles.settingDescription}>
                Send notifications when schedule conflicts are detected
              </Text>
            </View>
            <Switch
              value={formData.notifyOnConflicts}
              onValueChange={(value) =>
                setFormData({...formData, notifyOnConflicts: value})
              }
              trackColor={{false: '#3F3F46', true: '#06B6D4'}}
              thumbColor={formData.notifyOnConflicts ? '#FFFFFF' : '#A1A1AA'}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.createButton, loading && styles.disabledButton]}
            onPress={handleCreate}
            disabled={loading}>
            <Text style={styles.createButtonText}>
              {loading ? 'Creating...' : 'Create Household'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',  // Dark navy background
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#A1A1AA',
    lineHeight: 24,
  },
  form: {
    padding: 20,
    paddingTop: 10,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1A1A2E',  // Dark surface
    borderWidth: 2,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',  // Error red
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 4,
  },
  characterCount: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'right',
    marginTop: 4,
  },
  settingsContainer: {
    backgroundColor: '#1A1A2E',  // Dark surface
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingBottom: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#6366F1',  // Indigo primary
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#4B5563',  // Muted disabled
    opacity: 0.5,
  },
});
