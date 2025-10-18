/**
 * Edit Profile Screen
 * Allows users to edit their profile information
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {useAuth} from '@/contexts/AuthContext';
import {useNavigation} from '@react-navigation/native';
import {getResponsiveValue, spacing, typography, borderRadius} from '@/utils/responsive';
import {showError, showSuccess, showAlert, showConfirm} from '@/utils/alert';

export const EditProfileScreen: React.FC = () => {
  const {user, updateUserProfile, deleteAccount} = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      showError('Name is required');
      return;
    }

    if (!email.trim()) {
      showError('Email is required');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile({name, email});
      showSuccess('Profile updated successfully!');
      navigation.goBack();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showError(error.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleDeleteAccount = () => {
    showConfirm(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This will:\n\n• Delete all your shifts and notes\n• Remove you from all households\n• Permanently erase your account\n\nThis action cannot be undone!',
      () => {
        setShowDeleteModal(true);
      }
    );
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      showError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await deleteAccount(deletePassword);
      setShowDeleteModal(false);
      setDeletePassword('');
      showAlert('Account Deleted', 'Your account has been permanently deleted.');
    } catch (error: any) {
      console.error('Delete account error:', error);
      showError(error.message || 'Failed to delete account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        style={{flex: 1}}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Edit Profile</Text>
            <Text style={styles.subtitle}>Update your profile information</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
              <Text style={styles.helpText}>
                Note: Changing your email will require you to verify the new address
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={loading}>
                <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Danger Zone */}
            <View style={styles.dangerZone}>
              <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
              <Text style={styles.dangerZoneDescription}>
                Once you delete your account, there is no going back. Please be certain.
              </Text>
              <TouchableOpacity
                style={styles.deleteAccountButton}
                onPress={handleDeleteAccount}
                disabled={loading}>
                <Text style={styles.deleteAccountText}>Delete My Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Password</Text>
            <Text style={styles.modalMessage}>
              Enter your password to permanently delete your account
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Password"
              placeholderTextColor="#666"
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                }}
                disabled={loading}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmDeleteAccount}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete Forever</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.body,
    color: '#A1A1AA',
  },
  form: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body,
    color: '#FFFFFF',
  },
  helpText: {
    fontSize: 11,
    color: '#666',
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  saveButton: {
    backgroundColor: '#6366F1',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButtonText: {
    color: '#A1A1AA',
  },
  dangerZone: {
    marginTop: spacing.xxl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: '#2A2A3E',
  },
  dangerZoneTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: spacing.sm,
  },
  dangerZoneDescription: {
    fontSize: typography.caption,
    color: '#A1A1AA',
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  deleteAccountButton: {
    backgroundColor: '#7F1D1D',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  deleteAccountText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FCA5A5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: '#1F1F37',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  modalTitle: {
    fontSize: typography.title,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: typography.body,
    color: '#B4B4C8',
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalInput: {
    backgroundColor: '#0F0F23',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.body,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#374151',
  },
  modalCancelText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalDeleteButton: {
    backgroundColor: '#DC2626',
  },
  modalDeleteText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
