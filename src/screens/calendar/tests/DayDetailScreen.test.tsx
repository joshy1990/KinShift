import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { DayDetailScreen } from '../DayDetailScreen';
import { shiftService } from '@/services/shift.service';
import { dayNoteService } from '@/services/dayNote.service';
import { householdService } from '@/services/household.service';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentHouseholdId } from '@/contexts/HouseholdContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarStackParamList } from '@/types';

// Mock dependencies
jest.mock('@/services/shift.service');
jest.mock('@/services/dayNote.service');
jest.mock('@/services/household.service');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/HouseholdContext');
jest.mock('@/utils/alert');

const mockShiftService = shiftService as jest.Mocked<typeof shiftService>;
const mockDayNoteService = dayNoteService as jest.Mocked<typeof dayNoteService>;
const mockHouseholdService = householdService as jest.Mocked<typeof householdService>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseCurrentHouseholdId = useCurrentHouseholdId as jest.MockedFunction<typeof useCurrentHouseholdId>;

describe('DayDetailScreen', () => {
  const mockUser = {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
  };

  const mockHouseholdMembers = [
    {
      userId: 'josh-id',
      name: 'Josh',
      email: 'josh@example.com',
      role: 'admin' as const,
      joinedAt: new Date(),
    },
    {
      userId: 'sarah-id',
      name: 'Sarah',
      email: 'sarah@example.com',
      role: 'member' as const,
      joinedAt: new Date(),
    },
  ];

  const mockShifts = [
    {
      id: 'shift-1',
      title: 'Morning Shift',
      householdId: 'household-1',
      ownerId: 'josh-id',
      startTime: new Date('2025-10-16T08:00:00'),
      endTime: new Date('2025-10-16T16:00:00'),
      colorTag: '#2ECC71',
      shiftType: 'days' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedBy: 'josh-id',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      login: jest.fn(),
      logout: jest.fn(),
      signUp: jest.fn(),
      resetPassword: jest.fn(),
      updateProfile: jest.fn(),
    } as any);
  });

  it('should display shift owner name from household members instead of UNKNOWN USER', async () => {
    mockUseCurrentHouseholdId.mockReturnValue('household-1');
    mockHouseholdService.getHouseholdMembers.mockResolvedValue(mockHouseholdMembers);
    mockShiftService.getHouseholdShifts.mockResolvedValue(mockShifts);
    mockDayNoteService.getNotesByDate.mockResolvedValue([]);

    const navigation = {
      navigate: jest.fn(),
      goBack: jest.fn(),
    } as any;

    const route: NativeStackScreenProps<CalendarStackParamList, 'DayDetail'>['route'] = {
      key: 'DayDetail',
      name: 'DayDetail',
      params: {
        date: '2025-10-16',
        shifts: undefined,
      },
    };

    const { getByText } = render(
      <DayDetailScreen navigation={navigation} route={route} />
    );

    // Wait for the component to load household members
    await waitFor(() => {
      expect(mockHouseholdService.getHouseholdMembers).toHaveBeenCalledWith('household-1');
    });

    // Verify that Josh is displayed instead of UNKNOWN USER
    await waitFor(() => {
      expect(getByText(/Josh/)).toBeTruthy();
    });

    // Make sure "Unknown User" is not displayed
    expect(() => getByText(/Unknown User/)).toThrow();
  });

  it('should load household members on mount in household mode', async () => {
    mockUseCurrentHouseholdId.mockReturnValue('household-1');
    mockHouseholdService.getHouseholdMembers.mockResolvedValue(mockHouseholdMembers);
    mockShiftService.getHouseholdShifts.mockResolvedValue([]);
    mockDayNoteService.getNotesByDate.mockResolvedValue([]);

    const navigation = { navigate: jest.fn(), goBack: jest.fn() } as any;
    const route: NativeStackScreenProps<CalendarStackParamList, 'DayDetail'>['route'] = {
      key: 'DayDetail',
      name: 'DayDetail',
      params: {
        date: '2025-10-16',
      },
    };

    render(<DayDetailScreen navigation={navigation} route={route} />);

    await waitFor(() => {
      expect(mockHouseholdService.getHouseholdMembers).toHaveBeenCalledWith('household-1');
    });
  });

  it('should use current user data in personal mode', async () => {
    mockUseCurrentHouseholdId.mockReturnValue(null);
    mockShiftService.getShifts.mockResolvedValue({ shifts: [], hasMore: false });
    mockDayNoteService.getNotesByDate.mockResolvedValue([]);

    const navigation = { navigate: jest.fn(), goBack: jest.fn() } as any;
    const route: NativeStackScreenProps<CalendarStackParamList, 'DayDetail'>['route'] = {
      key: 'DayDetail',
      name: 'DayDetail',
      params: {
        date: '2025-10-16',
      },
    };

    render(<DayDetailScreen navigation={navigation} route={route} />);

    await waitFor(() => {
      // In personal mode, household service should NOT be called
      expect(mockHouseholdService.getHouseholdMembers).not.toHaveBeenCalled();
      // Should use personal shifts query instead
      expect(mockShiftService.getShifts).toHaveBeenCalled();
    });
  });
});
