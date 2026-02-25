/**
 * Screen render tests — AboutScreen
 *
 * Verifies:
 *  1. App name "KinShift" displayed
 *  2. Version number shown
 *  3. Company branding "Offeryn Software Ltd"
 *  4. Support links present (Privacy Policy, Terms, Contact)
 *  5. Features list rendered
 */

import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  NativeStackNavigationProp: {},
}));

jest.mock('@/utils/alert', () => ({
  showAlert: jest.fn(),
  showConfirm: jest.fn(),
  showError: jest.fn(),
}));

import { AboutScreen } from '@/screens/profile/AboutScreen';

describe('AboutScreen', () => {
  it('renders app name', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText('KinShift')).toBeTruthy();
  });

  it('renders version', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText(/Version/)).toBeTruthy();
  });

  it('renders company branding', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText(/Offeryn Software Ltd/)).toBeTruthy();
  });

  it('renders Contact Support link', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText('Contact Support')).toBeTruthy();
  });

  it('renders Privacy Policy link', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText('Privacy Policy')).toBeTruthy();
  });

  it('renders Terms of Service link', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText('Terms of Service')).toBeTruthy();
  });

  it('renders feature list', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText(/Shared household calendars/)).toBeTruthy();
    expect(getByText(/Real-time shift updates/)).toBeTruthy();
  });

  it('renders subtitle', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText('Family Shift Coordination App')).toBeTruthy();
  });
});
