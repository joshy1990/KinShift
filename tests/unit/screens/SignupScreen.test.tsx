/**
 * Screen render tests — SignupScreen
 *
 * Verifies:
 *  1. Name, email, password, confirm password inputs render
 *  2. Sign Up button is present
 *  3. Validation for mismatched passwords
 *  4. Calls signUp with correct args
 *  5. Link to login screen
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockSignUp = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signIn: jest.fn(),
    signUp: mockSignUp,
    signOut: jest.fn(),
    updateUserProfile: jest.fn(),
    deleteAccount: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ children }: any) => children,
  }),
}));

import { SignupScreen } from '@/screens/auth/SignupScreen';

const mockProps = {
  navigation: { navigate: mockNavigate, goBack: jest.fn() } as any,
  route: { key: 'Signup', name: 'Signup' as const, params: undefined },
};

describe('SignupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders name input', () => {
    const { getByPlaceholderText } = render(<SignupScreen {...mockProps} />);
    expect(getByPlaceholderText(/name/i)).toBeTruthy();
  });

  it('renders email input', () => {
    const { getByPlaceholderText } = render(<SignupScreen {...mockProps} />);
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
  });

  it('renders password input', () => {
    const { getByPlaceholderText } = render(<SignupScreen {...mockProps} />);
    expect(getByPlaceholderText('Create a secure password')).toBeTruthy();
  });

  it('renders confirm password input', () => {
    const { getByPlaceholderText } = render(<SignupScreen {...mockProps} />);
    expect(getByPlaceholderText(/confirm/i)).toBeTruthy();
  });

  it('renders sign up button', () => {
    const { getByText } = render(<SignupScreen {...mockProps} />);
    expect(getByText(/sign up|create account|register/i)).toBeTruthy();
  });

  it('shows link to login', () => {
    const { getByText } = render(<SignupScreen {...mockProps} />);
    expect(getByText(/log in|sign in|already have/i)).toBeTruthy();
  });

  it('validates passwords must match', async () => {
    const { getByText, getByPlaceholderText } = render(<SignupScreen {...mockProps} />);
    
    fireEvent.changeText(getByPlaceholderText(/name/i), 'Test User');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a secure password'), 'password1');
    fireEvent.changeText(getByPlaceholderText(/confirm/i), 'password2');
    
    fireEvent.press(getByText(/sign up|create account|register/i));

    await waitFor(() => {
      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });

  it('calls signUp with correct args', async () => {
    mockSignUp.mockResolvedValue(undefined);

    const { getByText, getByPlaceholderText } = render(<SignupScreen {...mockProps} />);
    
    fireEvent.changeText(getByPlaceholderText(/name/i), 'Test User');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a secure password'), 'Password123!');
    fireEvent.changeText(getByPlaceholderText(/confirm/i), 'Password123!');
    
    fireEvent.press(getByText(/sign up|create account|register/i));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('test@test.com', 'Password123!', 'Test User');
    });
  });
});
