/**
 * Unit tests for CreateHouseholdScreen
 */

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'u1', name: 'Test User', email: 'test@example.com' },
  })),
}));

jest.mock('@/contexts/HouseholdContext', () => ({
  useHousehold: jest.fn(() => ({
    createHousehold: jest.fn().mockResolvedValue({
      id: 'h1',
      name: 'My Household',
      joinCode: 'ABC123',
    }),
  })),
}));

jest.mock('@/utils/alert', () => ({
  showAlert: jest.fn(),
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CreateHouseholdScreen } from '@/screens/household/CreateHouseholdScreen';

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

describe('CreateHouseholdScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the form fields', () => {
    const { getByText, getByPlaceholderText } = render(
      <CreateHouseholdScreen navigation={mockNavigation} route={{} as any} />
    );
    expect(getByText(/Household Name/i)).toBeTruthy();
    expect(getByPlaceholderText(/e\.g\./i)).toBeTruthy();
  });

  it('renders create button', () => {
    const { getByText } = render(
      <CreateHouseholdScreen navigation={mockNavigation} route={{} as any} />
    );
    expect(getByText(/Create Household/i)).toBeTruthy();
  });

  it('validates empty name', async () => {
    const { getByText } = render(
      <CreateHouseholdScreen navigation={mockNavigation} route={{} as any} />
    );
    fireEvent.press(getByText(/Create Household/i));

    await waitFor(() => {
      expect(getByText(/Household name is required/i)).toBeTruthy();
    });
  });

  it('validates name too short', async () => {
    const { getByText, getByPlaceholderText } = render(
      <CreateHouseholdScreen navigation={mockNavigation} route={{} as any} />
    );
    fireEvent.changeText(getByPlaceholderText(/e\.g\./i), 'ab');
    fireEvent.press(getByText(/Create Household/i));

    await waitFor(() => {
      expect(getByText(/at least 3 characters/i)).toBeTruthy();
    });
  });

  it('renders toggle settings', () => {
    const { getByText } = render(
      <CreateHouseholdScreen navigation={mockNavigation} route={{} as any} />
    );
    expect(getByText(/Require approval for new shifts/i)).toBeTruthy();
  });

  it('does not render allow-member-edit-others toggle (owner-only editing enforced)', () => {
    const { queryByText } = render(
      <CreateHouseholdScreen navigation={mockNavigation} route={{} as any} />
    );
    expect(queryByText(/Allow members to edit/i)).toBeNull();
  });
});
