/**
 * Unit tests for ShiftTypePicker component
 */

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/utils/shiftTypeHelpers', () => ({
  getAllShiftTypes: jest.fn(() => ['day', 'night', 'twilight', 'split', 'holiday', 'off', 'sick', 'training', 'custom']),
  getQuickShiftTypes: jest.fn(() => ['day', 'night', 'holiday', 'off']),
  getShiftTypeColor: jest.fn(() => '#4A90D9'),
  getShiftTypeName: jest.fn((type: string) => type.charAt(0).toUpperCase() + type.slice(1)),
  getShiftTypeEmoji: jest.fn(() => '☀️'),
  getShiftTypeDescription: jest.fn((type: string) => `Description for ${type}`),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ShiftTypePicker } from '@/components/ShiftTypePicker';

describe('ShiftTypePicker', () => {
  const defaultProps = {
    selectedType: 'day' as any,
    onSelectType: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders shift type label', () => {
    const { getByText } = render(<ShiftTypePicker {...defaultProps} />);
    expect(getByText('Shift Type')).toBeTruthy();
  });

  it('renders all 9 shift types when quickAccessOnly is false (default)', () => {
    const { getAllByRole } = render(<ShiftTypePicker {...defaultProps} />);
    const buttons = getAllByRole('button');
    expect(buttons.length).toBe(9);
  });

  it('renders only quick shift types + More button when quickAccessOnly', () => {
    const { getByText } = render(
      <ShiftTypePicker {...defaultProps} quickAccessOnly />
    );
    expect(getByText('Day')).toBeTruthy();
    expect(getByText('Night')).toBeTruthy();
    expect(getByText('More')).toBeTruthy();
  });

  it('calls onSelectType when a type is pressed', () => {
    const onSelectType = jest.fn();
    const { getByText } = render(
      <ShiftTypePicker {...defaultProps} onSelectType={onSelectType} />
    );
    
    fireEvent.press(getByText('Night'));
    expect(onSelectType).toHaveBeenCalledWith('night');
  });

  it('shows type description for selected type', () => {
    const { getByText } = render(<ShiftTypePicker {...defaultProps} />);
    expect(getByText('Description for day')).toBeTruthy();
  });

  it('disables buttons when disabled prop is true', () => {
    const onSelectType = jest.fn();
    const { getAllByRole } = render(
      <ShiftTypePicker {...defaultProps} onSelectType={onSelectType} disabled />
    );
    // All buttons should have disabled state
    const buttons = getAllByRole('button');
    buttons.forEach(button => {
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });
});
