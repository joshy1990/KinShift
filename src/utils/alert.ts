/**
 * Cross-platform Alert Utility
 * Provides consistent alert behavior across web and native platforms
 */

import { Alert, Platform } from 'react-native';

/**
 * Show an alert message that works on both web and native platforms
 * @param title - Alert title (on web, only message is shown if no title needed)
 * @param message - Alert message/description
 * @param buttons - Optional buttons (native only, web shows OK)
 */
export const showAlert = (
  title: string,
  message?: string,
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>
) => {
  if (Platform.OS === 'web') {
    // On web, show simple browser alert
    const displayText = message ? `${title}\n\n${message}` : title;
    (global as any).alert(displayText);
    
    // If there are buttons with onPress handlers, execute the first non-cancel one
    if (buttons) {
      const defaultButton = buttons.find(b => b.style !== 'cancel' && b.onPress);
      if (defaultButton?.onPress) {
        defaultButton.onPress();
      }
    }
  } else {
    // On native, use React Native Alert
    if (buttons) {
      Alert.alert(title, message, buttons);
    } else {
      Alert.alert(title, message);
    }
  }
};

/**
 * Show a confirmation dialog
 * @param title - Dialog title
 * @param message - Dialog message
 * @param onConfirm - Called when user confirms
 * @param onCancel - Called when user cancels (optional)
 */
export const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  if (Platform.OS === 'web') {
    const confirmed = (global as any).confirm(`${title}\n\n${message}`);
    if (confirmed && onConfirm) {
      onConfirm();
    } else if (!confirmed && onCancel) {
      onCancel();
    }
  } else {
    Alert.alert(title, message, [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: 'OK',
        onPress: onConfirm,
      },
    ]);
  }
};

/**
 * Show an error alert
 * @param message - Error message to display
 */
export const showError = (message: string) => {
  showAlert('Error', message);
};

/**
 * Show a success alert
 * @param message - Success message to display
 */
export const showSuccess = (message: string) => {
  showAlert('Success', message);
};
