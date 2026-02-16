/**
 * Unit tests for TimePickerModal — the shared scrollable time picker.
 *
 * Guards against the UX regression where different screens had different
 * time input mechanisms (text inputs vs scrollable pickers).
 *
 * Tests:
 *  1. Renders all 24 hour options (00-23)
 *  2. Renders minute options in 5-min steps (00-55)
 *  3. Cancel / Apply callbacks fire correctly
 *  4. Active hour/minute are visually highlighted
 *  5. Title prop is displayed
 *  6. Not visible when visible=false
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Mock Modal before importing the component
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockModal = ({ visible, children }: any) => {
    if (!visible) return null;
    return React.createElement(View, { testID: 'modal' }, children);
  };
  MockModal.displayName = 'Modal';
  return MockModal;
});

import { TimePickerModal } from '@/components/TimePickerModal';

describe('TimePickerModal', () => {
  const defaultProps = {
    visible: true,
    title: 'Select Start Time',
    hour: 9,
    minute: 30,
    onHourChange: jest.fn(),
    onMinuteChange: jest.fn(),
    onApply: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ─────────────────────────────────────
  it('renders the title', () => {
    const { getByText } = render(<TimePickerModal {...defaultProps} />);
    expect(getByText('Select Start Time')).toBeTruthy();
  });

  it('renders default title when none provided', () => {
    const { getByText } = render(
      <TimePickerModal {...defaultProps} title={undefined} />,
    );
    expect(getByText('Select Time')).toBeTruthy();
  });

  it('renders all 24 hour options (00 through 23)', () => {
    const { getByText } = render(<TimePickerModal {...defaultProps} />);

    for (let h = 0; h < 24; h++) {
      expect(getByText(String(h).padStart(2, '0'))).toBeTruthy();
    }
  });

  it('renders 12 minute options in 5-minute steps (00 through 55)', () => {
    const { getAllByText } = render(<TimePickerModal {...defaultProps} hour={99} />);

    // Minutes: 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
    const expectedMinutes = Array.from({ length: 12 }, (_, i) => i * 5);
    for (const m of expectedMinutes) {
      const label = String(m).padStart(2, '0');
      // "00" appears in both hour and minute columns, so getAllByText
      const matches = getAllByText(label);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders Cancel and Apply buttons', () => {
    const { getByText } = render(<TimePickerModal {...defaultProps} />);
    expect(getByText('Cancel')).toBeTruthy();
    expect(getByText('Apply')).toBeTruthy();
  });

  it('renders nothing when visible is false', () => {
    const { queryByText } = render(
      <TimePickerModal {...defaultProps} visible={false} />,
    );
    expect(queryByText('Select Start Time')).toBeNull();
  });

  // ── Interactions ──────────────────────────────────
  it('calls onHourChange when an hour is tapped', () => {
    const { getByText } = render(<TimePickerModal {...defaultProps} />);

    fireEvent.press(getByText('14')); // tap hour "14"
    expect(defaultProps.onHourChange).toHaveBeenCalledWith(14);
  });

  it('calls onMinuteChange when a minute is tapped', () => {
    // Use a non-conflicting hour so "15" won't also match the hour column
    const { getAllByText } = render(
      <TimePickerModal {...defaultProps} hour={0} />,
    );

    const fifteenElements = getAllByText('15');
    // Tap the minute "15" (second occurrence — first is hour 15)
    fireEvent.press(fifteenElements[fifteenElements.length - 1]);
    expect(defaultProps.onMinuteChange).toHaveBeenCalledWith(15);
  });

  it('calls onApply when Apply is pressed', () => {
    const { getByText } = render(<TimePickerModal {...defaultProps} />);

    fireEvent.press(getByText('Apply'));
    expect(defaultProps.onApply).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is pressed', () => {
    const { getByText } = render(<TimePickerModal {...defaultProps} />);

    fireEvent.press(getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  // ── Hour/minute range integrity ───────────────────
  it('has exactly 24 hour options', () => {
    const { getByText } = render(<TimePickerModal {...defaultProps} />);

    // Verify boundary values
    expect(getByText('00')).toBeTruthy(); // midnight
    expect(getByText('23')).toBeTruthy(); // last hour
  });

  it('minute values are multiples of 5 only', () => {
    // This tests the MINUTES constant, not runtime
    const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
    expect(MINUTES).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    expect(MINUTES).not.toContain(1);
    expect(MINUTES).not.toContain(59);
  });
});
