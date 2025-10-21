/**
 * Subscription Context Tests
 * Tests for subscription state management
 */

import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {Text, View} from 'react-native';
import {SubscriptionProvider, useSubscription} from '../SubscriptionContext';

// Mock RevenueCat
jest.mock('@/services/revenueCat.service', () => ({
  revenueCatService: {
    initialize: jest.fn(),
    hasActiveSubscription: jest.fn().mockReturnValue(false),
    getActiveSubscription: jest.fn().mockReturnValue(null),
    hasEntitlement: jest.fn().mockReturnValue(false),
    getExpirationDate: jest.fn().mockReturnValue(null),
    willRenew: jest.fn().mockReturnValue(false),
    getOfferings: jest.fn().mockResolvedValue([]),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    refreshCustomerInfo: jest.fn(),
    logout: jest.fn(),
  },
}));

// Mock Subscription Service
jest.mock('@/services/subscription.service', () => ({
  subscriptionService: {
    changeSubscriptionTier: jest.fn(),
  },
}));

// Mock AuthContext
jest.mock('../AuthContext', () => ({
  useAuth: jest.fn().mockReturnValue({user: null}),
}));

describe('SubscriptionContext', () => {
  // Test component that uses subscription context
  const TestComponent = () => {
    const subscription = useSubscription();
    return (
      <View>
        <Text testID="tier">{subscription.currentTier}</Text>
        <Text testID="loading">{subscription.isLoading ? 'loading' : 'ready'}</Text>
        <Text testID="has-active">{subscription.hasActiveSubscription ? 'yes' : 'no'}</Text>
      </View>
    );
  };

  it('should provide subscription context', async () => {
    const {getByTestId} = render(
      <SubscriptionProvider>
        <TestComponent />
      </SubscriptionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('tier')).toBeDefined();
    });
  });

  it('should throw error when used outside provider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      render(<TestComponent />);
    }).toThrow();

    consoleErrorSpy.mockRestore();
  });

  it('should initialize with free tier by default', async () => {
    const {getByTestId} = render(
      <SubscriptionProvider>
        <TestComponent />
      </SubscriptionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('tier').props.children).toBe('free');
    });
  });

  it('should have correct free tier features', async () => {
    const FeatureComponent = () => {
      const {features} = useSubscription();
      return (
        <View>
          <Text testID="max-households">{features.maxHouseholds}</Text>
          <Text testID="max-members">{features.maxMembersPerHousehold}</Text>
          <Text testID="ads-free">{features.adsFree ? 'yes' : 'no'}</Text>
        </View>
      );
    };

    const {getByTestId} = render(
      <SubscriptionProvider>
        <FeatureComponent />
      </SubscriptionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('max-households').props.children).toBe(1);
      expect(getByTestId('max-members').props.children).toBe(2);
      expect(getByTestId('ads-free').props.children).toBe('no');
    });
  });

  it('should expose purchase method', async () => {
    let purchaseMethod: any;

    const PurchaseComponent = () => {
      const {purchaseSubscription} = useSubscription();
      purchaseMethod = purchaseSubscription;
      return <Text testID="ready">Ready</Text>;
    };

    const {getByTestId} = render(
      <SubscriptionProvider>
        <PurchaseComponent />
      </SubscriptionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('ready')).toBeDefined();
      expect(typeof purchaseMethod).toBe('function');
    });
  });

  it('should expose restore purchases method', async () => {
    let restoreMethod: any;

    const RestoreComponent = () => {
      const {restorePurchases} = useSubscription();
      restoreMethod = restorePurchases;
      return <Text testID="ready">Ready</Text>;
    };

    const {getByTestId} = render(
      <SubscriptionProvider>
        <RestoreComponent />
      </SubscriptionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('ready')).toBeDefined();
      expect(typeof restoreMethod).toBe('function');
    });
  });

  it('should track active subscriptions', async () => {
    let hasActive: any;

    const CheckComponent = () => {
      const {hasActiveSubscription} = useSubscription();
      hasActive = hasActiveSubscription;
      return <Text testID="ready">Ready</Text>;
    };

    const {getByTestId} = render(
      <SubscriptionProvider>
        <CheckComponent />
      </SubscriptionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('ready')).toBeDefined();
      expect(typeof hasActive).toBe('boolean');
    });
  });

  it('should track expiration date', async () => {
    let expirationDate: any;

    const DateComponent = () => {
      const {expirationDate: expDate} = useSubscription();
      expirationDate = expDate;
      return <Text testID="ready">Ready</Text>;
    };

    const {getByTestId} = render(
      <SubscriptionProvider>
        <DateComponent />
      </SubscriptionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('ready')).toBeDefined();
      expect(expirationDate === null || expirationDate instanceof Date).toBe(true);
    });
  });

  it('should track renewal status', async () => {
    let willRenewStatus: any;

    const RenewComponent = () => {
      const {willRenew} = useSubscription();
      willRenewStatus = willRenew;
      return <Text testID="ready">Ready</Text>;
    };

    const {getByTestId} = render(
      <SubscriptionProvider>
        <RenewComponent />
      </SubscriptionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('ready')).toBeDefined();
      expect(typeof willRenewStatus).toBe('boolean');
    });
  });
});
