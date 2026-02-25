/**
 * Unit tests for SyncStatusIndicator & NetworkBanner components
 */

jest.mock('@/hooks/useConnectivity', () => ({
  useConnectivity: jest.fn(),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SyncStatusIndicator, NetworkBanner } from '@/components/SyncStatusIndicator';
import { useConnectivity } from '@/hooks/useConnectivity';

const mockConnectivity = useConnectivity as jest.Mock;

const defaultConnected = {
  network: {
    isConnected: true,
    type: 'wifi',
    isInternetReachable: true,
    connectionDescription: 'WiFi',
    networkQuality: 'excellent' as const,
  },
  sync: {
    pendingCount: 0,
    isSyncing: false,
    pendingEdits: [],
    forcSync: jest.fn(),
    clearSynced: jest.fn(),
  },
  isFullyOnline: true,
  canSync: false,
};

const defaultOffline = {
  ...defaultConnected,
  network: {
    ...defaultConnected.network,
    isConnected: false,
    connectionDescription: 'Offline',
    networkQuality: 'offline' as const,
  },
  isFullyOnline: false,
};

describe('SyncStatusIndicator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders online status', () => {
    mockConnectivity.mockReturnValue(defaultConnected);
    const { getByText } = render(<SyncStatusIndicator showDetails />);
    expect(getByText('Online')).toBeTruthy();
  });

  it('renders offline status', () => {
    mockConnectivity.mockReturnValue(defaultOffline);
    const { getAllByText } = render(<SyncStatusIndicator showDetails />);
    expect(getAllByText('Offline').length).toBeGreaterThanOrEqual(1);
  });

  it('renders syncing status', () => {
    mockConnectivity.mockReturnValue({
      ...defaultConnected,
      sync: { ...defaultConnected.sync, isSyncing: true },
    });
    const { getByText } = render(<SyncStatusIndicator showDetails />);
    expect(getByText('Syncing...')).toBeTruthy();
  });

  it('renders pending count', () => {
    mockConnectivity.mockReturnValue({
      ...defaultConnected,
      sync: { ...defaultConnected.sync, pendingCount: 3 },
      canSync: true,
    });
    const { getByText } = render(<SyncStatusIndicator showDetails />);
    expect(getByText('3 pending')).toBeTruthy();
  });

  it('calls onPress handler when provided', () => {
    const onPress = jest.fn();
    mockConnectivity.mockReturnValue(defaultConnected);
    const { getByText } = render(
      <SyncStatusIndicator showDetails onPress={onPress} />
    );
    fireEvent.press(getByText('Online'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('triggers force sync when canSync and no onPress', () => {
    const forcSync = jest.fn();
    mockConnectivity.mockReturnValue({
      ...defaultConnected,
      sync: { ...defaultConnected.sync, pendingCount: 2, forcSync },
      canSync: true,
    });
    const { getByText } = render(<SyncStatusIndicator showDetails />);
    fireEvent.press(getByText('2 pending'));
    expect(forcSync).toHaveBeenCalled();
  });
});

describe('NetworkBanner', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when online with no pending syncs', () => {
    mockConnectivity.mockReturnValue(defaultConnected);
    const { toJSON } = render(<NetworkBanner />);
    expect(toJSON()).toBeNull();
  });

  it('renders offline banner', () => {
    mockConnectivity.mockReturnValue(defaultOffline);
    const { getByText } = render(<NetworkBanner />);
    expect(getByText(/offline/i)).toBeTruthy();
  });

  it('renders pending changes banner with sync button', () => {
    const forcSync = jest.fn();
    mockConnectivity.mockReturnValue({
      ...defaultConnected,
      sync: { ...defaultConnected.sync, pendingCount: 5, forcSync },
      canSync: true,
    });
    const { getByText } = render(<NetworkBanner />);
    expect(getByText(/5 change/)).toBeTruthy();
    
    fireEvent.press(getByText('Sync Now'));
    expect(forcSync).toHaveBeenCalled();
  });
});
