/**
 * Unit tests for UpgradePrompt component
 *
 * Tests:
 *  1. Renders with standard tier info
 *  2. Renders with premium tier info
 *  3. Shows title, message, and current limit
 *  4. Fires onClose when "Maybe Later" is pressed
 *  5. Fires onUpgrade when "Upgrade Now" is pressed
 *  6. Not visible when visible=false
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { UpgradePrompt } from '@/components/UpgradePrompt';

describe('UpgradePrompt', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onUpgrade: jest.fn(),
    title: 'Member Limit Reached',
    message: 'You need to upgrade to add more members.',
    currentLimit: 2,
    upgradeToTier: 'standard' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ─────────────────────────────────────────────────────
  it('renders title and message', () => {
    const { getByText } = render(<UpgradePrompt {...defaultProps} />);
    expect(getByText('Member Limit Reached')).toBeTruthy();
    expect(getByText('You need to upgrade to add more members.')).toBeTruthy();
  });

  it('shows current limit', () => {
    const { getByText } = render(<UpgradePrompt {...defaultProps} />);
    expect(getByText('Current Limit:')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });

  it('shows standard tier info', () => {
    const { getByText } = render(<UpgradePrompt {...defaultProps} />);
    expect(getByText('Standard Plan')).toBeTruthy();
    expect(getByText('£2.99/mo')).toBeTruthy();
  });

  it('shows premium tier info', () => {
    const { getByText } = render(
      <UpgradePrompt {...defaultProps} upgradeToTier="premium" />,
    );
    expect(getByText('Premium Plan')).toBeTruthy();
    expect(getByText('£4.99/mo')).toBeTruthy();
  });

  it('shows premium features including priority support', () => {
    const { getByText } = render(
      <UpgradePrompt {...defaultProps} upgradeToTier="premium" />,
    );
    expect(getByText(/Priority support/)).toBeTruthy();
    expect(getByText(/Unlimited households/)).toBeTruthy();
  });

  // ── Actions ───────────────────────────────────────────────────────
  it('calls onClose when "Maybe Later" is pressed', () => {
    const { getByText } = render(<UpgradePrompt {...defaultProps} />);
    fireEvent.press(getByText('Maybe Later'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onUpgrade when "Upgrade Now" is pressed', () => {
    const { getByText } = render(<UpgradePrompt {...defaultProps} />);
    fireEvent.press(getByText('Upgrade Now'));
    expect(defaultProps.onUpgrade).toHaveBeenCalledTimes(1);
  });

  // ── Visibility ────────────────────────────────────────────────────
  it('renders nothing when visible is false', () => {
    const { queryByText } = render(
      <UpgradePrompt {...defaultProps} visible={false} />,
    );
    expect(queryByText('Member Limit Reached')).toBeNull();
  });

  // ── Both buttons present ──────────────────────────────────────────
  it('renders both action buttons', () => {
    const { getByText } = render(<UpgradePrompt {...defaultProps} />);
    expect(getByText('Maybe Later')).toBeTruthy();
    expect(getByText('Upgrade Now')).toBeTruthy();
  });
});
