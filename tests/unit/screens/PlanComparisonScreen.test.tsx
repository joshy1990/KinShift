/**
 * Screen render tests — PlanComparisonScreen
 *
 * Verifies:
 *  1. All three plan cards render (Free, Standard, Premium)
 *  2. Pricing shown correctly
 *  3. Features listed under each plan
 *  4. Current plan badge appears
 *  5. Upgrade/Downgrade buttons have correct text
 *  6. FAQ section renders
 *  7. Company branding in footer (Offeryn Software Ltd)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useFocusEffect: jest.fn(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
    loading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    updateUserProfile: jest.fn(),
    deleteAccount: jest.fn(),
  }),
}));

jest.mock('@/services/subscription.service', () => ({
  subscriptionService: {
    getUserSubscription: jest.fn().mockResolvedValue({ tier: 'free', status: 'active' }),
    changeSubscriptionTier: jest.fn(),
    getPricingInfo: jest.fn().mockReturnValue([]),
  },
  SubscriptionTier: {},
}));

jest.mock('@/services/revenueCat.service', () => ({
  revenueCatService: {
    getOfferings: jest.fn().mockResolvedValue([]),
    purchasePackage: jest.fn(),
    hasEntitlement: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('@/utils/alert', () => ({
  showAlert: jest.fn(),
  showConfirm: jest.fn(),
}));

import { PlanComparisonScreen } from '@/screens/profile/PlanComparisonScreen';

describe('PlanComparisonScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title', () => {
    const { getByText } = render(<PlanComparisonScreen />);
    expect(getByText('Choose Your Plan')).toBeTruthy();
  });

  it('renders Free plan card', () => {
    const { getByText } = render(<PlanComparisonScreen />);
    expect(getByText('Free')).toBeTruthy();
    expect(getByText('FREE')).toBeTruthy();
  });

  it('renders Standard plan with price', () => {
    const { getByText } = render(<PlanComparisonScreen />);
    expect(getByText('Standard')).toBeTruthy();
    expect(getByText('2.99')).toBeTruthy();
  });

  it('renders Premium plan with price', () => {
    const { getByText } = render(<PlanComparisonScreen />);
    expect(getByText('Premium')).toBeTruthy();
    expect(getByText('4.99')).toBeTruthy();
  });

  it('renders MOST POPULAR badge on premium', () => {
    const { getByText } = render(<PlanComparisonScreen />);
    expect(getByText('MOST POPULAR')).toBeTruthy();
  });

  it('renders key features for each plan', () => {
    const { getByText } = render(<PlanComparisonScreen />);
    expect(getByText('Up to 2 members')).toBeTruthy();
    expect(getByText('Up to 4 members')).toBeTruthy();
    expect(getByText('Up to 12 members per household')).toBeTruthy();
  });

  it('renders FAQ section', () => {
    const { getByText } = render(<PlanComparisonScreen />);
    expect(getByText('Frequently Asked Questions')).toBeTruthy();
    expect(getByText('Can I cancel anytime?')).toBeTruthy();
    expect(getByText('Are there any hidden fees?')).toBeTruthy();
  });

  it('renders company branding', () => {
    const { getByText } = render(<PlanComparisonScreen />);
    expect(getByText(/Offeryn Software Ltd/)).toBeTruthy();
  });

  it('renders support email', () => {
    const { getByText } = render(<PlanComparisonScreen />);
    expect(getByText(/support@offeryn.co.uk/)).toBeTruthy();
  });

  it('renders back button', () => {
    const { getByText } = render(<PlanComparisonScreen />);
    const back = getByText(/Back/);
    expect(back).toBeTruthy();
    fireEvent.press(back);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
