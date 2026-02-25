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
  Dimensions,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/types';
import {useAuth} from '@/contexts/AuthContext';
import {showError, showSuccess, showConfirm} from '@/utils/alert';
import auth from '@react-native-firebase/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const {width, height} = Dimensions.get('window');

// Responsive breakpoints
const isTablet = width >= 768;
const isDesktop = width >= 1024;

// Dynamic sizing functions
const getResponsiveValue = (mobile: number, tablet: number, desktop: number) => {
  if (isDesktop) return desktop;
  if (isTablet) return tablet;
  return mobile;
};

const getMaxWidth = () => {
  if (isDesktop) return 450;
  if (isTablet) return 400;
  return width - 48;
};

export const LoginScreen: React.FC<Props> = ({navigation}) => {
  const {signIn} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  const handleLogin = async () => {
    // Prevent double-tap
    if (loading) return;
    
    // Reset errors
    setError('');
    setEmailError(false);
    setPasswordError(false);

    // Validation
    if (!email || !password) {
      setError('Please enter both email and password');
      if (!email) setEmailError(true);
      if (!password) setPasswordError(true);
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      // Success - errors will be cleared on navigation
    } catch (error: any) {
      console.error('Login error:', error);
      // Set error state for visual feedback
      setEmailError(true);
      setPasswordError(true);
      
      // Set user-friendly error message
      let errorMessage = 'Invalid email or password';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format';
        setPasswordError(false);
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      showError('Please enter your email address first');
      return;
    }

    showConfirm(
      'Reset Password',
      `Send password reset email to ${email}?`,
      async () => {
        setLoading(true);
        try {
          await auth().sendPasswordResetEmail(email);
          showSuccess('Password reset email sent! Check your email inbox for the link.');
        } catch (error: any) {
          console.error('? Password reset error:', error);
          let errorMessage = 'Failed to send reset email. Please try again.';
          if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email address';
          } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
          }
          showError(errorMessage);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F23" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.backgroundGradient} />
          
          <View style={styles.formContainer}>
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your KinShift account</Text>
          </View>

          <View style={styles.form}>
            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

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
              <View style={styles.labelRow}>
                <Text style={[styles.label, passwordError && styles.labelError]}>Password</Text>
                <TouchableOpacity 
                  onPress={handleForgotPassword}
                  disabled={loading}>
                  <Text style={styles.forgotPasswordText}>Forgot?</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, passwordError && styles.inputError]}
                placeholder="Enter your password"
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

            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleLogin} 
              disabled={loading}
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.7}>
              <Text style={styles.secondaryButtonText}>Don't have an account? Sign Up</Text>
            </TouchableOpacity>
          </View>
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
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: getResponsiveValue(24, 40, 60),
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: height,
    paddingTop: 0,
  },
  formContainer: {
    maxWidth: getMaxWidth(),
    width: '100%',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    backgroundColor: '#1A1A2E',
    borderBottomLeftRadius: getResponsiveValue(30, 40, 50),
    borderBottomRightRadius: getResponsiveValue(30, 40, 50),
  },
  backButton: {
    paddingTop: getResponsiveValue(60, 40, 30),
    paddingBottom: getResponsiveValue(20, 16, 12),
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#6366F1',
    fontSize: getResponsiveValue(14, 16, 18),
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    paddingVertical: getResponsiveValue(30, 40, 50),
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
    width: getResponsiveValue(40, 45, 50),
    height: getResponsiveValue(40, 45, 50),
    position: 'relative',
    transform: [{rotate: '45deg'}],
  },
  chainLinkLeft: {
    position: 'absolute',
    width: getResponsiveValue(20, 22, 25),
    height: getResponsiveValue(32, 36, 40),
    borderWidth: getResponsiveValue(4, 5, 5),
    borderColor: '#60A5FA',
    borderRadius: getResponsiveValue(10, 11, 12),
    left: 0,
    top: getResponsiveValue(4, 4, 5),
  },
  chainLinkRight: {
    position: 'absolute',
    width: getResponsiveValue(20, 22, 25),
    height: getResponsiveValue(32, 36, 40),
    borderWidth: getResponsiveValue(4, 5, 5),
    borderColor: '#818CF8',
    borderRadius: getResponsiveValue(10, 11, 12),
    right: 0,
    top: getResponsiveValue(4, 4, 5),
  },
  logoIcon: {
    fontSize: getResponsiveValue(20, 24, 28),
    color: '#6366F1',
    fontWeight: 'bold',
  },
  title: {
    fontSize: getResponsiveValue(24, 28, 32),
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: getResponsiveValue(14, 16, 18),
    color: '#A1A1AA',
    textAlign: 'center',
  },
  form: {
    width: '100%',
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
    marginBottom: getResponsiveValue(20, 22, 24),
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D4D4D8',
    marginLeft: 4,
  },
  labelError: {
    color: '#EF4444',
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    marginRight: 4,
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
    paddingVertical: getResponsiveValue(16, 18, 20),
    borderRadius: getResponsiveValue(12, 14, 16),
    alignItems: 'center',
    marginTop: getResponsiveValue(8, 12, 16),
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: getResponsiveValue(14, 16, 18),
    alignItems: 'center',
    marginTop: getResponsiveValue(16, 18, 20),
    backgroundColor: 'transparent',
    borderRadius: getResponsiveValue(12, 14, 16),
  },
  secondaryButtonText: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: '500',
  },
});
