import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HouseholdStackParamList} from '@/types';
import {useAuth} from '@/contexts/AuthContext';
import {useHousehold} from '@/contexts/HouseholdContext';
import {showAlert, showError} from '@/utils/alert';

type Props = NativeStackScreenProps<HouseholdStackParamList, 'JoinHousehold'>;

export const JoinHouseholdScreen: React.FC<Props> = ({navigation}) => {
  const {user} = useAuth();
  const {joinHousehold} = useHousehold();
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const formatJoinCode = (text: string): string => {
    // Remove any non-alphanumeric characters and convert to uppercase
    const cleaned = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    // Add dashes every 3 characters for readability (XXX-XXX format)
    return cleaned.replace(/(.{3})/g, '$1-').replace(/-$/, '');
  };

  const validateJoinCode = (code: string): boolean => {
    // Remove dashes and check if it's 6 characters
    const cleanCode = code.replace(/-/g, '');
    return cleanCode.length === 6 && /^[A-Z0-9]+$/.test(cleanCode);
  };

  const handleJoin = async () => {
    const cleanCode = joinCode.replace(/-/g, '');
    
    if (!validateJoinCode(joinCode)) {
      setError('Please enter a valid 6-character join code');
      return;
    }

    if (!user) {
      showError('You must be logged in to join a household');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const household = await joinHousehold(cleanCode);
      
      showAlert('Welcome!', `You've successfully joined "${household.name}"\n\nYou can now see all household shifts and events!`);
      navigation.navigate('HouseholdDetail', {householdId: household.id});
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to join household';
      if (errorMessage.includes('not found')) {
        setError('Invalid join code. Please check and try again.');
      } else if (errorMessage.includes('already a member')) {
        setError('You are already a member of this household.');
      } else if (errorMessage.includes('expired')) {
        setError('This join code has expired. Please ask for a new one.');
      } else if (errorMessage.includes('Member limit') || errorMessage.includes('limit reached')) {
        setError('This household has reached its member limit. Ask the admin to upgrade their subscription plan.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (text: string) => {
    const formatted = formatJoinCode(text);
    // Limit to 7 characters (6 + 1 dash)
    if (formatted.length <= 7) {
      setJoinCode(formatted);
      if (error) {
        setError('');
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Join Household</Text>
          <Text style={styles.subtitle}>
            Enter the 6-character join code shared by a household member
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.codeContainer}>
            <Text style={styles.label}>Join Code</Text>
            <TextInput
              style={[styles.codeInput, error ? styles.inputError : null]}
              value={joinCode}
              onChangeText={handleCodeChange}
              placeholder="XXX-XXX"
              placeholderTextColor="#BDC3C7"
              maxLength={7}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="default"
              textAlign="center"
            />
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <Text style={styles.helperText}>
                Example: ABC-123 (dashes are optional)
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.joinButton, loading && styles.disabledButton]}
            onPress={handleJoin}
            disabled={loading || !validateJoinCode(joinCode)}>
            <Text style={styles.joinButtonText}>
              {loading ? 'Joining...' : 'Join Household'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateHousehold')}>
          <Text style={styles.createButtonText}>Create New Household</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',  // Dark navy background
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    marginBottom: 40,
  },
  codeContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 12,
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: '#1A1A2E',  // Dark surface
    borderWidth: 2,
    borderColor: '#6366F1',  // Indigo primary
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#6366F1',
    letterSpacing: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
  inputError: {
    borderColor: '#EF4444',  // Error red
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 4,
  },
  helperText: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  joinButton: {
    backgroundColor: '#6366F1',  // Indigo primary
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  joinButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#4B5563',  // Muted disabled
    opacity: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2A3E',  // Dark border
  },
  dividerText: {
    fontSize: 14,
    color: '#71717A',
    marginHorizontal: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6366F1',  // Indigo primary
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',  // Indigo primary
  },
});
