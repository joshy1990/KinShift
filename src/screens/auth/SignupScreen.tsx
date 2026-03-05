import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/types';
import {useAuth} from '@/contexts/AuthContext';
import {getResponsiveValue, spacing, typography} from '@/utils/responsive';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export const SignupScreen: React.FC<Props> = ({navigation}) => {
  const {signUp} = useAuth();
  const {height} = useWindowDimensions();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);

  const handleSignup = async () => {
    // Prevent double-tap
    if (loading) return;
    
    // Reset errors
    setError('');
    setNameError(false);
    setEmailError(false);
    setPasswordError(false);
    setConfirmPasswordError(false);

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      if (!name) setNameError(true);
      if (!email) setEmailError(true);
      if (!password) setPasswordError(true);
      if (!confirmPassword) setConfirmPasswordError(true);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setPasswordError(true);
      setConfirmPasswordError(true);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setPasswordError(true);
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name);
      // Success - errors cleared on navigation
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Set user-friendly error message
      let errorMessage = 'Signup failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered';
        setEmailError(true);
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format';
        setEmailError(true);
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
        setPasswordError(true);
      } else if (error.message) {
        errorMessage = error.message;
        setEmailError(true);
        setPasswordError(true);
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F23" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.backgroundGradient, {height: height * 0.4}]} />
          
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>? Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <View style={styles.chainLink}>
                  <View style={styles.chainLinkLeft} />
                  <View style={styles.chainLinkRight} />
                </View>
              </View>
            </View>
            <Text style={styles.title}>Join KinShift</Text>
            <Text style={styles.subtitle}>Create your account and start organizing</Text>
          </View>

          <View style={styles.form}>
            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <Text style={[styles.label, nameError && styles.labelError]}>Full Name</Text>
              <TextInput
                style={[styles.input, nameError && styles.inputError]}
                placeholder="Enter your full name"
                placeholderTextColor="#6B7280"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setNameError(false);
                  setError('');
                }}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, emailError && styles.labelError]}>Email</Text>
              <TextInput
                style={[styles.input, emailError && styles.inputError]}
                placeholder="you@example.com"
                placeholderTextColor="#6B7280"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError(false);
                  setError('');
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, passwordError && styles.labelError]}>Password</Text>
              <TextInput
                style={[styles.input, passwordError && styles.inputError]}
                placeholder="Create a secure password"
                placeholderTextColor="#6B7280"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError(false);
                  setError('');
                }}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, confirmPasswordError && styles.labelError]}>Confirm Password</Text>
              <TextInput
                style={[styles.input, confirmPasswordError && styles.inputError]}
                placeholder="Confirm your password"
                placeholderTextColor="#6B7280"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setConfirmPasswordError(false);
                  setError('');
                }}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleSignup} 
              disabled={loading}
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}>
              <Text style={styles.secondaryButtonText}>Already have an account? Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A2E',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    paddingTop: 60,
    paddingBottom: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#6366F1',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: getResponsiveValue(80, 90, 100),
    height: getResponsiveValue(80, 90, 100),
    borderRadius: getResponsiveValue(40, 45, 50),
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  chainLink: {
    width: 45,
    height: 45,
    position: 'relative',
    transform: [{rotate: '45deg'}],
  },
  chainLinkLeft: {
    position: 'absolute',
    width: 22,
    height: 36,
    borderWidth: 5,
    borderColor: '#60A5FA',
    borderRadius: 11,
    left: 0,
    top: 4,
  },
  chainLinkRight: {
    position: 'absolute',
    width: 22,
    height: 36,
    borderWidth: 5,
    borderColor: '#818CF8',
    borderRadius: 11,
    right: 0,
    top: 4,
  },
  logoIcon: {
    fontSize: 24,
    color: '#6366F1',
    fontWeight: 'bold',
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.body,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  form: {
    paddingHorizontal: 8,
    paddingBottom: 40,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D4D4D8',
    marginBottom: 8,
    marginLeft: 4,
  },
  labelError: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryButtonText: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: '500',
  },
});
