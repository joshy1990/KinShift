/**
 * Unit tests for EditProfileScreen
 */

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'u1', name: 'Test User', email: 'test@example.com' },
    updateUserProfile: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/utils/alert', () => ({
  showAlert: jest.fn(),
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

jest.mock('@react-native-firebase/storage', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    ref: jest.fn(() => ({
      putFile: jest.fn().mockResolvedValue(undefined),
      getDownloadURL: jest.fn().mockResolvedValue('https://example.com/photo.jpg'),
    })),
  })),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

describe('EditProfileScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the edit form with user data', () => {
    const { getByDisplayValue } = render(
      <EditProfileScreen navigation={mockNavigation} route={{} as any} />
    );
    expect(getByDisplayValue('Test User')).toBeTruthy();
  });

  it('renders save button', () => {
    const { getByText } = render(
      <EditProfileScreen navigation={mockNavigation} route={{} as any} />
    );
    expect(getByText(/Save Changes/i)).toBeTruthy();
  });

  it('validates empty name', async () => {
    const { showError } = require('@/utils/alert');
    const { getByText, getByDisplayValue } = render(
      <EditProfileScreen navigation={mockNavigation} route={{} as any} />
    );

    const nameInput = getByDisplayValue('Test User');
    fireEvent.changeText(nameInput, '');
    fireEvent.press(getByText(/Save Changes/i));

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith('Name is required');
    });
  });
});
