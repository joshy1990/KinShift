/**
 * Unit tests for CalendarLegend component
 */

jest.mock('@/utils/shiftTypeHelpers', () => ({
  getAllShiftTypes: jest.fn(() => ['day', 'night', 'off']),
  getShiftTypeColor: jest.fn((type: string) => {
    const map: Record<string, string> = { day: '#FFD700', night: '#1E3A5F', off: '#E8E8E8' };
    return map[type] || '#CCC';
  }),
  getShiftTypeLabel: jest.fn((type: string) => type.charAt(0).toUpperCase()),
  getShiftTypeName: jest.fn((type: string) => type.charAt(0).toUpperCase() + type.slice(1)),
  getShiftTypeEmoji: jest.fn((type: string) => {
    const map: Record<string, string> = { day: '☀️', night: '🌙', off: '😴' };
    return map[type] || '⚙️';
  }),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CalendarLegend } from '@/components/CalendarLegend';

describe('CalendarLegend', () => {
  it('renders header text', () => {
    const { getByText } = render(<CalendarLegend />);
    expect(getByText(/Legend/)).toBeTruthy();
  });

  it('shows shift types when expanded (default)', () => {
    const { getByText } = render(<CalendarLegend />);
    expect(getByText('Day')).toBeTruthy();
    expect(getByText('Night')).toBeTruthy();
    expect(getByText('Off')).toBeTruthy();
  });

  it('collapses when defaultExpanded is false', () => {
    const { queryByText } = render(<CalendarLegend defaultExpanded={false} />);
    expect(queryByText('Day')).toBeNull();
    expect(queryByText('Night')).toBeNull();
  });

  it('toggles expand/collapse on header press', () => {
    const { getByText, queryByText } = render(<CalendarLegend />);
    
    // Initially expanded
    expect(getByText('Day')).toBeTruthy();
    
    // Collapse
    fireEvent.press(getByText(/Legend/));
    expect(queryByText('Day')).toBeNull();
    
    // Expand again
    fireEvent.press(getByText(/Legend/));
    expect(getByText('Day')).toBeTruthy();
  });

  it('only shows activeTypes when provided', () => {
    const { getByText, queryByText } = render(
      <CalendarLegend activeTypes={['day'] as any} />
    );
    expect(getByText('Day')).toBeTruthy();
    expect(queryByText('Night')).toBeNull();
  });

  it('renders household members section when provided', () => {
    const members = [
      { userId: 'u1', name: 'Alice', color: '#FF0000' },
      { userId: 'u2', name: 'Bob', color: '#00FF00' },
    ];
    const { getByText } = render(<CalendarLegend householdMembers={members} />);
    
    expect(getByText('Household Members')).toBeTruthy();
    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('Bob')).toBeTruthy();
  });

  it('does not render members section when no members', () => {
    const { queryByText } = render(<CalendarLegend />);
    expect(queryByText('Household Members')).toBeNull();
  });
});
