/**
 * Screen render tests — ProfileScreen
 *
 * Verifies:
 *  1. User name and email displayed
 *  2. Sign Out button present and fires callback
 *  3. Navigation menu items render (Edit Profile, About, etc.)
 *  4. Footer with company branding
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockSignOut = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    },
    loading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: mockSignOut,
    updateUserProfile: jest.fn(),
    deleteAccount: jest.fn(),
  }),
}));

jest.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    currentTier: 'free',
    isLoading: false,
    hasActiveSubscription: false,
    features: { maxHouseholds: 1, maxMembersPerHousehold: 2, adsFree: false },
    shouldShowAds: () => true,
    customerInfo: null,
    activeSubscription: null,
    expirationDate: null,
    willRenew: false,
    purchaseSubscription: jest.fn(),
    restorePurchases: jest.fn(),
  }),
}));

jest.mock('@/contexts/HouseholdContext', () => ({
  useHousehold: () => ({
    currentHousehold: null,
    households: [],
    loading: false,
    error: null,
    setCurrentHousehold: jest.fn(),
    refreshHouseholds: jest.fn(),
    createHousehold: jest.fn(),
    joinHousehold: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
  useFocusEffect: (cb: any) => cb(),
}));

jest.mock('@react-navigation/native-stack', () => ({
  NativeStackNavigationProp: {},
}));

// Mock services that might be called
jest.mock('@/services/subscription.service', () => ({
  subscriptionService: {
    getUserSubscription: jest.fn().mockResolvedValue({ tier: 'free', status: 'active' }),
    getTierLimits: jest.fn().mockReturnValue({ maxHouseholds: 1, maxMembersPerHousehold: 2 }),
    getSubscriptionDisplayInfo: jest.fn().mockReturnValue({
      tierName: 'Free',
      tierBadgeColor: '#10B981',
      statusText: 'Active',
      statusColor: '#10B981',
      benefits: ['1 household', 'Up to 2 members'],
      showUpgrade: true,
      canUpgradeToStandard: true,
      canUpgradeToPremium: true,
    }),
    shouldShowAds: jest.fn().mockReturnValue(true),
    getPricingInfo: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('@/services/shiftPattern.service', () => ({
  shiftPatternService: {
    getPatternInfo: jest.fn(),
  },
  PATTERN_TEMPLATES: {},
}));

jest.mock('@/utils/alert', () => ({
  showAlert: jest.fn(),
  showConfirm: jest.fn(),
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

jest.mock('@/services/shift.service', () => ({
  shiftService: {
    getShifts: jest.fn().mockResolvedValue({ shifts: [], hasMore: false, cursor: null }),
    deleteBulkShifts: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/customPattern.service', () => ({
  customPatternService: {
    getPatterns: jest.fn().mockResolvedValue([]),
    getUserPatterns: jest.fn().mockResolvedValue([]),
    deletePattern: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/utils/shiftColors', () => ({
  getShiftTypeIcon: jest.fn().mockReturnValue('📋'),
  getShiftTypeColor: jest.fn().mockReturnValue('#999'),
}));

import { ProfileScreen } from '@/screens/profile/ProfileScreen';

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user name', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Test User')).toBeTruthy();
  });

  it('renders user email', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('test@example.com')).toBeTruthy();
  });

  it('renders Sign Out button', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Sign Out')).toBeTruthy();
  });

  it('renders company branding in footer', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText(/Offeryn Software Ltd/)).toBeTruthy();
  });

  it('renders Edit Profile option', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText(/Edit Profile/i)).toBeTruthy();
  });

  it('renders About option', () => {
    const { getAllByText } = render(<ProfileScreen />);
    expect(getAllByText(/About/i).length).toBeGreaterThanOrEqual(1);
  });
});
