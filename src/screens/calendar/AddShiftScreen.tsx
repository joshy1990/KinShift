import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CalendarStackParamList, ShiftType} from '@/types';
import {format, isSameDay} from 'date-fns';
import {shiftService} from '@/services/shift.service';
import {notificationService} from '@/services/notification.service';
import {useAuth} from '@/contexts/AuthContext';
import {useCurrentHouseholdId} from '@/contexts/HouseholdContext';
import {showAlert, showSuccess, showError} from '@/utils/alert';
import {
  detectShiftType,
  getShiftTypeDisplayName,
  getShiftTypeIcon,
  SHIFT_TYPE_COLORS,
} from '@/utils/shiftColors';
import {ShiftTypePicker} from '@/components/ShiftTypePicker';
import {requiresStartEndTime, getShiftTypeName} from '@/utils/shiftTypeHelpers';

// Default times for each shift type
const getDefaultTimesForShiftType = (type: ShiftType, baseDate: Date): { start: Date; end: Date; title: string } => {
  const start = new Date(baseDate);
  const end = new Date(baseDate);
  
  switch (type) {
    case 'day':
      start.setHours(9, 0, 0, 0);
      end.setHours(17, 0, 0, 0);
      return { start, end, title: 'Day Shift' };
    case 'night':
      start.setHours(22, 0, 0, 0);
      end.setHours(6, 0, 0, 0);
      end.setDate(end.getDate() + 1); // Next day
      return { start, end, title: 'Night Shift' };
    case 'twilight':
      start.setHours(14, 0, 0, 0);
      end.setHours(22, 0, 0, 0);
      return { start, end, title: 'Twilight Shift' };
    case 'split':
      start.setHours(6, 0, 0, 0);
      end.setHours(14, 0, 0, 0);
      return { start, end, title: 'Split Shift' };
    case 'holiday':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 0, 0);
      return { start, end, title: 'Holiday' };
    case 'off':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 0, 0);
      return { start, end, title: 'Day Off' };
    case 'sick':
      start.setHours(9, 0, 0, 0);
      end.setHours(17, 0, 0, 0);
      return { start, end, title: 'Sick Leave' };
    case 'training':
      start.setHours(8, 0, 0, 0);
      end.setHours(16, 0, 0, 0);
      return { start, end, title: 'Training' };
    case 'custom':
    default:
      // Keep current times
      return { start: new Date(baseDate), end: new Date(baseDate), title: 'Custom Shift' };
  }
};

type Props = NativeStackScreenProps<CalendarStackParamList, 'AddShift'>;

// Simple pattern presets
const SIMPLE_PATTERNS = {
  '4on4off': { name: '4 On, 4 Off', workDays: 4, restDays: 4 },
  '2on3off': { name: '2 On, 3 Off', workDays: 2, restDays: 3 },
  '5on2off': { name: '5 On, 2 Off (Mon-Fri)', workDays: 5, restDays: 2 },
};

import {customPatternService, CustomPattern} from '@/services/customPattern.service';

export const AddShiftScreen: React.FC<Props> = ({navigation, route}) => {
  const {user} = useAuth();
  const currentHouseholdId = useCurrentHouseholdId();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [is24HourFormat, setIs24HourFormat] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState<'start' | 'end'>('start');
  const [pickerHour, setPickerHour] = useState(9);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [customPatterns, setCustomPatterns] = useState<CustomPattern[]>([]);
  
  const initialStartTime = route.params?.date || new Date();
  initialStartTime.setHours(9, 0, 0, 0); // 9 AM default
  const initialEndTime = new Date(initialStartTime);
  initialEndTime.setHours(17, 0, 0, 0); // 5 PM default
  
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [startTimeText, setStartTimeText] = useState(
    is24HourFormat ? format(initialStartTime, 'HH:mm') : format(initialStartTime, 'h:mm a')
  );
  const [endTimeText, setEndTimeText] = useState(
    is24HourFormat ? format(initialEndTime, 'HH:mm') : format(initialEndTime, 'h:mm a')
  );
  const [startAMPM, setStartAMPM] = useState<'AM' | 'PM'>(initialStartTime.getHours() >= 12 ? 'PM' : 'AM');
  const [endAMPM, setEndAMPM] = useState<'AM' | 'PM'>(initialEndTime.getHours() >= 12 ? 'PM' : 'AM');
  const [shiftType, setShiftType] = useState<ShiftType>(detectShiftType(initialStartTime, initialEndTime));
  const [notes, setNotes] = useState('');
  const [usePattern, setUsePattern] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<keyof typeof SIMPLE_PATTERNS | string>('4on4off');
  const [selectedCustomPattern, setSelectedCustomPattern] = useState<CustomPattern | null>(null);
  const [patternMonths, setPatternMonths] = useState(6);
  
  // Holiday/OFF date range state
  const [holidayStartDate, setHolidayStartDate] = useState(initialStartTime);
  const [holidayEndDate, setHolidayEndDate] = useState(initialStartTime);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Split shift state - two separate time ranges
  const [split1StartTime, setSplit1StartTime] = useState(new Date(initialStartTime.setHours(9, 0, 0, 0)));
  const [split1EndTime, setSplit1EndTime] = useState(new Date(initialStartTime.setHours(12, 0, 0, 0)));
  const [split2StartTime, setSplit2StartTime] = useState(new Date(initialStartTime.setHours(14, 0, 0, 0)));
  const [split2EndTime, setSplit2EndTime] = useState(new Date(initialStartTime.setHours(18, 0, 0, 0)));
  const [split1StartAMPM, setSplit1StartAMPM] = useState<'AM' | 'PM'>('AM');
  const [split1EndAMPM, setSplit1EndAMPM] = useState<'AM' | 'PM'>('PM');
  const [split2StartAMPM, setSplit2StartAMPM] = useState<'AM' | 'PM'>('PM');
  const [split2EndAMPM, setSplit2EndAMPM] = useState<'AM' | 'PM'>('PM');
  const [activeSplitPicker, setActiveSplitPicker] = useState<'split1Start' | 'split1End' | 'split2Start' | 'split2End' | null>(null);

  // Load custom patterns when screen mounts or when user returns from pattern builder
  useEffect(() => {
    const loadPatterns = async () => {
      if (!user) return;
      try {
        const patterns = await customPatternService.getUserPatterns(user.id);
        setCustomPatterns(patterns);
        console.log('📋 Loaded', patterns.length, 'custom patterns');
      } catch (error) {
        console.error('Failed to load custom patterns:', error);
      }
    };
    loadPatterns();
  }, [user]);

  // Reload patterns when navigating back from PatternBuilder
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      if (!user) return;
      try {
        const patterns = await customPatternService.getUserPatterns(user.id);
        setCustomPatterns(patterns);
        console.log('🔄 Reloaded', patterns.length, 'custom patterns');
      } catch (error) {
        console.error('Failed to reload custom patterns:', error);
      }
    });
    return unsubscribe;
  }, [navigation, user]);

  // Smart time input formatting - handles "0455" → "04:55", "455" → "04:55", "4:55" → "04:55"
  const formatTimeInput = (input: string): string => {
    // Remove all non-digits
    const digitsOnly = input.replace(/\D/g, '');
    
    if (digitsOnly.length === 0) return '';
    if (digitsOnly.length <= 2) {
      // Just hours: "4" or "04"
      return digitsOnly;
    }
    if (digitsOnly.length === 3) {
      // "455" → "04:55"
      return `${digitsOnly[0].padStart(2, '0')}:${digitsOnly.substring(1)}`;
    }
    if (digitsOnly.length >= 4) {
      // "0455" → "04:55"
      const hours = digitsOnly.substring(0, 2);
      const minutes = digitsOnly.substring(2, 4);
      return `${hours}:${minutes}`;
    }
    return input;
  };

  // Parse custom time input with smart formatting
  const parseTimeInput = (input: string, type: 'start' | 'end') => {
    // Format as user types
    const formatted = formatTimeInput(input);
    
    // Update the text field immediately
    if (type === 'start') {
      setStartTimeText(formatted);
    } else {
      setEndTimeText(formatted);
    }
    
    // Parse the formatted time
    const timeParts = formatted.match(/(\d{1,2}):?(\d{0,2})/);
    if (!timeParts) return;
    
    let hours = parseInt(timeParts[1]);
    let minutes = timeParts[2] ? parseInt(timeParts[2]) : 0;
    
    // Handle 12hr format with AM/PM
    if (!is24HourFormat) {
      const ampm = type === 'start' ? startAMPM : endAMPM;
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }
    
    // Validate
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return;
    
    // Create new time
    const baseTime = type === 'start' ? startTime : endTime;
    const newTime = new Date(baseTime);
    newTime.setHours(hours, minutes, 0, 0);
    
    if (type === 'start') {
      setStartTime(newTime);
      setShiftType(detectShiftType(newTime, endTime));
    } else {
      setEndTime(newTime);
      setShiftType(detectShiftType(startTime, newTime));
    }
  };

  // Toggle AM/PM for 12hr format
  const toggleAMPM = (type: 'start' | 'end', value: 'AM' | 'PM') => {
    if (type === 'start') {
      setStartAMPM(value);
      const newTime = new Date(startTime);
      let hours = newTime.getHours();
      if (value === 'PM' && hours < 12) {
        hours += 12;
      } else if (value === 'AM' && hours >= 12) {
        hours -= 12;
      }
      newTime.setHours(hours);
      setStartTime(newTime);
      setStartTimeText(format(newTime, 'h:mm'));
      setShiftType(detectShiftType(newTime, endTime));
    } else {
      setEndAMPM(value);
      const newTime = new Date(endTime);
      let hours = newTime.getHours();
      if (value === 'PM' && hours < 12) {
        hours += 12;
      } else if (value === 'AM' && hours >= 12) {
        hours -= 12;
      }
      newTime.setHours(hours);
      setEndTime(newTime);
      setEndTimeText(format(newTime, 'h:mm'));
      setShiftType(detectShiftType(startTime, newTime));
    }
  };

  // Toggle 12hr/24hr format
  const toggle24HourFormat = () => {
    const new24Hr = !is24HourFormat;
    setIs24HourFormat(new24Hr);
    
    // Reformat time displays
    if (new24Hr) {
      setStartTimeText(format(startTime, 'HH:mm'));
      setEndTimeText(format(endTime, 'HH:mm'));
    } else {
      setStartTimeText(format(startTime, 'h:mm'));
      setEndTimeText(format(endTime, 'h:mm'));
      setStartAMPM(startTime.getHours() >= 12 ? 'PM' : 'AM');
      setEndAMPM(endTime.getHours() >= 12 ? 'PM' : 'AM');
    }
  };

  // Smart handler when shift type changes - auto-fills times and title
  const handleShiftTypeChange = (newType: ShiftType) => {
    // If custom is selected, navigate to Pattern Builder
    if (newType === 'custom') {
      navigation.navigate('PatternBuilder');
      return;
    }
    
    setShiftType(newType);
    
    // Get default times and title for this shift type
    const defaults = getDefaultTimesForShiftType(newType, route.params?.date || new Date());
    
    // Only auto-fill if title is empty or matches a shift type name
    const currentTitleIsDefault = !title || 
      title.endsWith('Shift') || 
      title === 'Holiday' || 
      title === 'Day Off' ||
      title === 'Sick Leave' ||
      title === 'Training';
    
    if (currentTitleIsDefault) {
      setTitle(defaults.title);
    }
    
    // For holiday/off types, set up date range
    if (newType === 'holiday' || newType === 'off') {
      const baseDate = route.params?.date || new Date();
      setHolidayStartDate(new Date(baseDate));
      setHolidayEndDate(new Date(baseDate));
    }
    
    // For split shifts, initialize split times with sensible defaults
    if (newType === 'split') {
      const baseDate = route.params?.date || new Date();
      // Shift 1: 9:00 AM - 12:00 PM
      setSplit1StartTime(new Date(baseDate.setHours(9, 0, 0, 0)));
      setSplit1EndTime(new Date(baseDate.setHours(12, 0, 0, 0)));
      setSplit1StartAMPM('AM');
      setSplit1EndAMPM('PM');
      
      // Shift 2: 2:00 PM - 6:00 PM
      setSplit2StartTime(new Date(baseDate.setHours(14, 0, 0, 0)));
      setSplit2EndTime(new Date(baseDate.setHours(18, 0, 0, 0)));
      setSplit2StartAMPM('PM');
      setSplit2EndAMPM('PM');
    }
    
    // Auto-fill times (only for types that need times)
    if (requiresStartEndTime(newType)) {
      setStartTime(defaults.start);
      setEndTime(defaults.end);
      
      // Update time text displays
      if (is24HourFormat) {
        setStartTimeText(format(defaults.start, 'HH:mm'));
        setEndTimeText(format(defaults.end, 'HH:mm'));
      } else {
        setStartTimeText(format(defaults.start, 'h:mm'));
        setEndTimeText(format(defaults.end, 'h:mm'));
      }
      
      setStartAMPM(defaults.start.getHours() >= 12 ? 'PM' : 'AM');
      setEndAMPM(defaults.end.getHours() >= 12 ? 'PM' : 'AM');
    }
  };

  // Simple time adjustment
  const adjustTime = (type: 'start' | 'end', hours: number) => {
    const current = type === 'start' ? startTime : endTime;
    const newTime = new Date(current);
    newTime.setHours(hours, 0, 0, 0);
    
    if (type === 'start') {
      setStartTime(newTime);
      setStartTimeText(is24HourFormat ? format(newTime, 'HH:mm') : format(newTime, 'h:mm'));
      setStartAMPM(newTime.getHours() >= 12 ? 'PM' : 'AM');
    } else {
      setEndTime(newTime);
      setEndTimeText(is24HourFormat ? format(newTime, 'HH:mm') : format(newTime, 'h:mm'));
      setEndAMPM(newTime.getHours() >= 12 ? 'PM' : 'AM');
      setShiftType(detectShiftType(startTime, newTime));
    }
  };

  // Open time picker modal
  const openTimePicker = (type: 'start' | 'end') => {
    const time = type === 'start' ? startTime : endTime;
    setPickerHour(time.getHours());
    setPickerMinute(time.getMinutes());
    setTimePickerType(type);
    setShowTimePicker(true);
  };

  // Apply selected time from picker
  const applyPickerTime = () => {
    const newTime = new Date(timePickerType === 'start' ? startTime : endTime);
    newTime.setHours(pickerHour, pickerMinute, 0, 0);
    
    // Handle split shift time pickers
    if (activeSplitPicker) {
      const baseDate = route.params?.date || new Date();
      const splitTime = new Date(baseDate);
      splitTime.setHours(pickerHour, pickerMinute, 0, 0);
      
      switch (activeSplitPicker) {
        case 'split1Start':
          setSplit1StartTime(splitTime);
          setSplit1StartAMPM(splitTime.getHours() >= 12 ? 'PM' : 'AM');
          break;
        case 'split1End':
          setSplit1EndTime(splitTime);
          setSplit1EndAMPM(splitTime.getHours() >= 12 ? 'PM' : 'AM');
          break;
        case 'split2Start':
          setSplit2StartTime(splitTime);
          setSplit2StartAMPM(splitTime.getHours() >= 12 ? 'PM' : 'AM');
          break;
        case 'split2End':
          setSplit2EndTime(splitTime);
          setSplit2EndAMPM(splitTime.getHours() >= 12 ? 'PM' : 'AM');
          break;
      }
      setActiveSplitPicker(null);
      setShowTimePicker(false);
      return;
    }
    
    // Handle regular time pickers
    if (timePickerType === 'start') {
      setStartTime(newTime);
      setStartTimeText(is24HourFormat ? format(newTime, 'HH:mm') : format(newTime, 'h:mm a'));
      setStartAMPM(newTime.getHours() >= 12 ? 'PM' : 'AM');
      setShiftType(detectShiftType(newTime, endTime));
    } else {
      setEndTime(newTime);
      setEndTimeText(is24HourFormat ? format(newTime, 'HH:mm') : format(newTime, 'h:mm a'));
      setEndAMPM(newTime.getHours() >= 12 ? 'PM' : 'AM');
      setShiftType(detectShiftType(startTime, newTime));
    }
    setShowTimePicker(false);
  };

  // Helper function to calculate actual cycle length for a pattern
  const calculatePatternCycleLength = (cells: any[]): number => {
    // Try all possible cycle lengths from 1 to 14
    // Start with smallest to find the true repeating unit
    for (let cycleLength = 1; cycleLength <= 14; cycleLength++) {
      // For each potential cycle, check if entire 14-day pattern repeats correctly
      let repeats = true;
      
      for (let i = 0; i < 14; i++) {
        const currentCell = cells[i];
        const referenceCell = cells[i % cycleLength];
        
        // Check if shift type matches
        if (currentCell.shiftType !== referenceCell.shiftType) {
          repeats = false;
          break;
        }
        
        // If both have shift times, verify times match exactly
        if (currentCell.shiftType !== null && referenceCell.shiftType !== null) {
          if (currentCell.startTime !== referenceCell.startTime ||
              currentCell.endTime !== referenceCell.endTime) {
            repeats = false;
            break;
          }
        }
      }
      
      if (repeats) {
        console.log(`✅ [PATTERN] Detected cycle length: ${cycleLength} days`);
        return cycleLength; // Found the smallest repeating cycle
      }
    }
    
    // Fallback (should never happen since 14-day always repeats)
    console.log('⚠️ [PATTERN] Could not detect cycle, defaulting to 14 days');
    return 14;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    // Allow overnight shifts - don't validate end time must be after start time
    // Example: Night shift 10pm to 6am is valid even though 22:00 > 06:00
    // The shift can span midnight

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check for existing shifts on the selected date
  const checkForConflicts = async (shiftDate: Date): Promise<any[]> => {
    if (!user) return [];
    
    const startOfDay = new Date(shiftDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(shiftDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('🔍 Checking conflicts for:', format(shiftDate, 'MMM dd, yyyy'));
    console.log('📅 Date range:', format(startOfDay, 'yyyy-MM-dd HH:mm'), 'to', format(endOfDay, 'yyyy-MM-dd HH:mm'));
    
    try {
      // Get shifts for this date range
      const result = await shiftService.getShifts({
        householdId: currentHouseholdId || undefined,
        startDate: startOfDay,
        endDate: endOfDay,
      });
      
      console.log('📊 Total shifts found:', result.shifts.length);
      
      // Filter to only current user's shifts on this specific day
      const userShifts = result.shifts.filter(shift => {
        const shiftStart = shift.startTime instanceof Date ? shift.startTime : new Date(shift.startTime);
        const isUserShift = shift.ownerId === user.id;
        const isOnThisDay = shiftStart >= startOfDay && shiftStart <= endOfDay;
        
        if (isUserShift && isOnThisDay) {
          console.log('✅ Found conflict:', shift.title, format(shiftStart, 'MMM dd HH:mm'));
        }
        
        return isUserShift && isOnThisDay;
      });
      
      console.log('⚠️ User conflicts:', userShifts.length);
      return userShifts;
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      return [];
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      showError('Please fix the errors before saving');
      return;
    }
    if (!user) {
      showError('You must be logged in to create shifts');
      return;
    }

    setLoading(true);
    
    try {
      // SPECIAL CASE: OFF shift type just deletes existing shifts (no new shift created)
      if (!usePattern && shiftType === 'off') {
        const selectedDate = route.params?.date || startTime;
        console.log('🗑️ OFF type selected - deleting existing shifts on:', format(selectedDate, 'MMM dd, yyyy'));
        
        // Get all shifts for this user on this date
        const result = await shiftService.getShifts(
          {
            ownerId: user.id,
          },
          {
            pageSize: 1000, // High limit to get ALL shifts
          }
        );
        
        // Filter to only this date
        const shiftsOnDate = result.shifts.filter(shift => {
          const shiftDate = shift.startTime && typeof shift.startTime === 'object' && 'seconds' in shift.startTime
            ? new Date((shift.startTime as any).seconds * 1000)
            : new Date(shift.startTime);
          return isSameDay(shiftDate, selectedDate);
        });
        
        console.log('🗑️ Found', shiftsOnDate.length, 'shift(s) to delete');
        
        // Delete all shifts on this date
        for (const shift of shiftsOnDate) {
          await shiftService.deleteShift(shift.id, user.id);
        }
        
        if (shiftsOnDate.length > 0) {
          showSuccess('Shift(s) removed - Day marked as OFF');
        } else {
          showSuccess('Day marked as OFF');
        }
        setLoading(false);
        navigation.goBack();
        return; // Don't create any shift, just delete and exit
      }
      if (usePattern) {
        // Create pattern of shifts
        const shiftsToCreate: any[] = [];
        const endDate = new Date(startTime);
        endDate.setMonth(endDate.getMonth() + patternMonths);

        // Check if custom pattern is selected
        if (selectedCustomPattern) {
          console.log('📅 Custom Pattern creation:', {
            patternName: selectedCustomPattern.name,
            patternMode: selectedCustomPattern.patternMode,
            startDate: format(startTime, 'MMM dd, yyyy'),
            dayOfWeekStart: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][startTime.getDay()],
            endDate: format(endDate, 'MMM dd, yyyy'),
            months: patternMonths,
            cellsTotal: selectedCustomPattern.cells.length,
          });

          // Determine cycle length based on pattern mode
          let cycleLength: number;
          if (selectedCustomPattern.patternMode === 'weekly') {
            // Weekly mode: Always use 7-day cycle (Mon-Sun repeat)
            cycleLength = 7;
            console.log('📅 Weekly mode - using 7-day cycle');
          } else {
            // Repetition mode: Auto-detect the cycle length
            cycleLength = calculatePatternCycleLength(selectedCustomPattern.cells);
            console.log(`🔄 Repetition mode - detected ${cycleLength}-day cycle`);
          }

          let currentDate = new Date(startTime);
          
          // Initialize dayInPattern based on pattern mode
          let dayInPattern: number = 0;
          if (selectedCustomPattern.patternMode === 'weekly') {
            // In weekly mode, always use 7-day cycle, starting from day 0 of the pattern
            console.log(`📅 Weekly mode - using fixed 7-day cycle starting from pattern day 0`);
          } else {
            // In repetition mode, start at day 0 and auto-detect the cycle length
            console.log(`🔄 Repetition mode - will auto-detect cycle length`);
          }

          while (currentDate <= endDate) {
            const cell = selectedCustomPattern.cells[dayInPattern];

            // Only create shift if this day has a shift type (not a day off)
            if (cell.shiftType !== null) {
              const [startHours, startMinutes] = cell.startTime.split(':').map(Number);
              const [endHours, endMinutes] = cell.endTime.split(':').map(Number);

              const shiftStart = new Date(currentDate);
              shiftStart.setHours(startHours, startMinutes, 0, 0);

              const shiftEnd = new Date(currentDate);
              shiftEnd.setHours(endHours, endMinutes, 0, 0);

              // Handle overnight shifts (e.g., night shift 20:00-06:00)
              if (shiftEnd <= shiftStart) {
                shiftEnd.setDate(shiftEnd.getDate() + 1);
              }

              shiftsToCreate.push({
                title: title.trim() || `${cell.shiftType.charAt(0).toUpperCase() + cell.shiftType.slice(1)} Shift`,
                householdId: currentHouseholdId || undefined,
                ownerId: user.id,
                startTime: shiftStart,
                endTime: shiftEnd,
                shiftType: cell.shiftType,
                notes: notes.trim(),
              });
            }

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
            dayInPattern = (dayInPattern + 1) % cycleLength; // Use detected cycle length
          }

          // Log the shifts that were created for debugging
          console.log(`✅ Custom pattern loop complete. Created ${shiftsToCreate.length} shift entries:`);
          shiftsToCreate.slice(0, 10).forEach((s, i) => {
            console.log(`  [${i}] ${format(s.startTime, 'MMM dd (EEE)')}: ${s.shiftType}`);
          });
          if (shiftsToCreate.length > 10) {
            console.log(`  ... and ${shiftsToCreate.length - 10} more shifts`);
          }

        } else {
          // Simple pattern (existing code)
          const pattern = SIMPLE_PATTERNS[selectedPattern as keyof typeof SIMPLE_PATTERNS];
          let currentDate = new Date(startTime);
          
          console.log('📅 Pattern creation:', {
            pattern: selectedPattern,
            patternName: pattern.name,
            startDate: format(startTime, 'MMM dd, yyyy'),
            endDate: format(endDate, 'MMM dd, yyyy'),
            months: patternMonths,
          });
        
          if ('workDays' in pattern) {
            // Simple work/rest pattern (e.g., 4 on 4 off)
            let isWorkPeriod = true;
            
            console.log('🔄 Starting pattern loop with', pattern.workDays, 'work days,', pattern.restDays, 'rest days');
            
            while (currentDate <= endDate) {
              const daysInPeriod = isWorkPeriod ? pattern.workDays : pattern.restDays;
              
              if (isWorkPeriod) {
                // Create shifts for work days
                for (let i = 0; i < daysInPeriod && currentDate <= endDate; i++) {
                  const shiftStart = new Date(currentDate);
                  shiftStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
                  
                  const shiftEnd = new Date(currentDate);
                  shiftEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
                  
                  // Handle overnight shifts
                  if (shiftEnd <= shiftStart) {
                    shiftEnd.setDate(shiftEnd.getDate() + 1);
                  }
                  
                  shiftsToCreate.push({
                    title: title.trim(),
                    householdId: currentHouseholdId || undefined,
                    ownerId: user.id,
                    startTime: shiftStart,
                    endTime: shiftEnd,
                    shiftType,
                    notes: notes.trim(),
                  });
                  
                  currentDate.setDate(currentDate.getDate() + 1);
                }
              } else {
                // Skip rest days
                currentDate.setDate(currentDate.getDate() + daysInPeriod);
              }
              
              isWorkPeriod = !isWorkPeriod;
            }
            
            console.log('✅ Pattern loop complete. Created', shiftsToCreate.length, 'shift entries');
          }
        }
        
        // CLEANUP: Delete existing shifts on dates where pattern will create shifts
        console.log('🧹 Cleaning up existing shifts before pattern creation...');
        try {
          const allExistingShifts = await shiftService.getShifts(
            {
              ownerId: user.id,
            },
            {
              pageSize: 1000,
            }
          );
          
          // Get unique dates from shiftsToCreate
          const patternDates = new Set(
            shiftsToCreate.map(shift => format(shift.startTime, 'yyyy-MM-dd'))
          );
          
          // Find existing shifts on those dates
          const shiftsToDelete = allExistingShifts.shifts.filter(shift => {
            const shiftDate = shift.startTime && typeof shift.startTime === 'object' && 'seconds' in shift.startTime
              ? new Date((shift.startTime as any).seconds * 1000)
              : new Date(shift.startTime);
            const dateKey = format(shiftDate, 'yyyy-MM-dd');
            return patternDates.has(dateKey);
          });
          
          if (shiftsToDelete.length > 0) {
            console.log(`🗑️ Deleting ${shiftsToDelete.length} existing shift(s) that conflict with pattern using BULK delete...`);
            const shiftIdsToDelete = shiftsToDelete.map(s => s.id);
            await shiftService.deleteBulkShifts(shiftIdsToDelete);
            console.log('✅ Bulk cleanup complete - ready to create pattern');
          } else {
            console.log('✅ No conflicts found - proceeding with pattern creation');
          }
        } catch (cleanupError) {
          console.error('❌ Pattern cleanup failed:', cleanupError);
          // Continue anyway - pattern will be created even if cleanup fails
        }
        
        // Create all shifts in batch (MUCH FASTER!)
        console.log(`Creating ${shiftsToCreate.length} shifts using batch write...`);
        const startBatch = Date.now();
        await shiftService.createBulkShifts(shiftsToCreate);
        const batchTime = Date.now() - startBatch;
        console.log(`✅ Batch creation completed in ${batchTime}ms (${(batchTime / shiftsToCreate.length).toFixed(1)}ms per shift)`);
        
        // Send ONE notification for all pattern shifts created
        if (currentHouseholdId) {
          try {
            await notificationService.notifyMultipleShiftsCreated(
              shiftsToCreate,
              { id: currentHouseholdId }
            );
          } catch (notifyError) {
            console.error('Failed to send pattern shift notification:', notifyError);
            // Don't fail the shift creation if notification fails
          }
        }
        
        showSuccess(`Created ${shiftsToCreate.length} shifts successfully!`);
      } else {
        // Create single shift
        const shiftData: any = {
          title: title.trim(),
          householdId: currentHouseholdId || undefined,
          ownerId: user.id,
          startTime,
          endTime,
          shiftType,
          notes: notes.trim(),
        };

        // For split shifts, add split times array
        if (shiftType === 'split') {
          shiftData.splitTimes = [
            {
              startTime: split1StartTime,
              endTime: split1EndTime,
            },
            {
              startTime: split2StartTime,
              endTime: split2EndTime,
            },
          ];
          // For split shifts, use the first shift's times as the main times
          shiftData.startTime = split1StartTime;
          shiftData.endTime = split2EndTime; // Overall end time
          
          console.log('💾 Saving split shift with data:', {
            shiftType: shiftData.shiftType,
            splitTimes: shiftData.splitTimes,
            mainStartTime: shiftData.startTime,
            mainEndTime: shiftData.endTime,
          });
        }

        const newShift = await shiftService.createShift(shiftData);
        
        console.log('✅ New shift created:', newShift.id);
        
        // CLEANUP: Ensure only ONE shift per THIS USER per day
        // (Other household members' shifts are NOT affected)
        console.log('🧹 Cleaning up duplicate shifts for user:', user.id);
        const selectedDate = route.params?.date || startTime;
        
        // Query all shifts for this user (with error handling)
        try {
          const allShifts = await shiftService.getShifts(
            {
              ownerId: user.id, // Only THIS user's shifts
            },
            {
              pageSize: 1000, // High limit to get ALL shifts for cleanup
            }
          );
          
          console.log('✅ Cleanup query successful - got', allShifts.shifts.length, 'total shifts');
          
          // Filter to only shifts on this date (still only THIS user)
          const shiftsOnDate = allShifts.shifts.filter(shift => {
            const shiftDate = shift.startTime && typeof shift.startTime === 'object' && 'seconds' in shift.startTime
              ? new Date((shift.startTime as any).seconds * 1000)
              : new Date(shift.startTime);
            const matches = isSameDay(shiftDate, selectedDate);
            if (matches) {
              console.log('  → Shift on this date:', {
                id: shift.id,
                title: shift.title,
                startTime: shiftDate,
                createdAt: shift.createdAt,
              });
            }
            return matches;
          });
          
          console.log('📊 Total shifts for THIS USER on', format(selectedDate, 'MMM dd'), ':', shiftsOnDate.length);
          
          // If there's more than one shift, keep only the NEWEST one (by createdAt)
          if (shiftsOnDate.length > 1) {
            // Sort by createdAt descending (newest first)
            const sortedShifts = shiftsOnDate.sort((a, b) => {
              const aCreated = a.createdAt && typeof a.createdAt === 'object' && 'seconds' in a.createdAt
                ? new Date((a.createdAt as any).seconds * 1000)
                : new Date(a.createdAt);
              const bCreated = b.createdAt && typeof b.createdAt === 'object' && 'seconds' in b.createdAt
                ? new Date((b.createdAt as any).seconds * 1000)
                : new Date(b.createdAt);
              return bCreated.getTime() - aCreated.getTime(); // Newest first
            });
            
            // Keep the first one (newest), delete the rest
            const newestShift = sortedShifts[0];
            const oldShifts = sortedShifts.slice(1);
            
            console.log('🗑️ Keeping newest shift:', newestShift.id, 'Deleting', oldShifts.length, 'old shift(s) FOR THIS USER');
            
            for (const oldShift of oldShifts) {
              console.log('  Deleting old shift:', oldShift.id, oldShift.title, 'Owner:', oldShift.ownerId);
              await shiftService.deleteShift(oldShift.id, user.id);
            }
            
            console.log('✅ Cleanup complete - Only 1 shift remains FOR THIS USER (other members unaffected)');
          } else {
            console.log('✅ No cleanup needed - only 1 shift on this date');
          }
        } catch (cleanupError) {
          console.error('❌ CLEANUP FAILED:', cleanupError);
          console.error('Index may not be ready yet. Shift created but duplicates not cleaned.');
          // Don't throw - shift was created successfully, just cleanup failed
        }

        // Send notification for single shift creation (only in household mode)
        if (currentHouseholdId && newShift.id) {
          try {
            await notificationService.notifyShiftCreated(
              newShift,
              { id: currentHouseholdId }
            );
          } catch (notifyError) {
            console.error('Failed to send shift creation notification:', notifyError);
            // Don't fail the shift creation if notification fails
          }
        }

        showSuccess('Shift created successfully!');
      }
      
      navigation.goBack();
    } catch (error) {
      console.error('Failed to create shift:', error);
      showError('Failed to create shift. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.label}>Shift Title *</Text>
            <TextInput
              style={[styles.input, errors.title ? styles.inputError : null]}
              value={title}
              onChangeText={setTitle}
            placeholder="e.g., Day Shift, Night Shift"
            placeholderTextColor="#6B7280"
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
        </View>

        {/* Date Display */}
        <View style={styles.section}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity 
            style={styles.dateBox}
            onPress={() => {
              // Could add DatePicker here for native platforms
              showAlert('Date Selection', 'Tap on a date in the calendar to create a shift for that day, or manually adjust the date below.');
            }}>
            <Text style={styles.dateText}>
              📅 {format(startTime, 'EEEE, MMMM d, yyyy')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>Shifts are created for the selected calendar date</Text>
        </View>

        {/* Shift Type - Now with smart auto-fill */}
        <View style={styles.section}>
          <ShiftTypePicker
            selectedType={shiftType}
            onSelectType={handleShiftTypeChange}
            quickAccessOnly={true}
          />
          <Text style={styles.helperText}>
            {requiresStartEndTime(shiftType) 
              ? 'Times auto-filled based on shift type. You can adjust them below.' 
              : 'Selected type does not require start/end times'}
          </Text>
        </View>

        {/* Time Format Toggle */}
        {requiresStartEndTime(shiftType) && (
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <Text style={styles.label}>Time Format</Text>
              <TouchableOpacity 
                style={[styles.formatToggle, is24HourFormat && styles.formatToggleActive]}
                onPress={toggle24HourFormat}>
                <Text style={[styles.formatToggleText, is24HourFormat && styles.formatToggleTextActive]}>
                  {is24HourFormat ? '24 Hour' : '12 Hour'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Times - Only for working shifts (but not split shifts) */}
        {requiresStartEndTime(shiftType) && shiftType !== 'split' && (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>Start Time *</Text>
              <TouchableOpacity 
                style={styles.timePickerButton}
                onPress={() => openTimePicker('start')}>
                <Text style={styles.timePickerText}>
                  🕐 {startTimeText} {!is24HourFormat && startAMPM}
                </Text>
                <Text style={styles.timePickerHint}>Tap to change</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>End Time *</Text>
              <TouchableOpacity 
                style={styles.timePickerButton}
                onPress={() => openTimePicker('end')}>
                <Text style={styles.timePickerText}>
                  🕐 {endTimeText} {!is24HourFormat && endAMPM}
                </Text>
                <Text style={styles.timePickerHint}>Tap to change</Text>
              </TouchableOpacity>
              {errors.time && <Text style={styles.errorText}>{errors.time}</Text>}
            </View>
          </>
        )}

        {/* Split Shift Times - Show two sets of time pickers */}
        {shiftType === 'split' && (
          <View style={styles.section}>
            <Text style={styles.label}>Split Shift Times *</Text>
            <Text style={styles.helperText}>
              Add two separate time ranges for your split shift
            </Text>
            
            {/* Shift 1 */}
            <View style={styles.splitShiftContainer}>
              <Text style={styles.splitShiftLabel}>Shift 1</Text>
              <View style={styles.splitTimeRow}>
                <View style={styles.splitTimeItem}>
                  <Text style={styles.splitTimeItemLabel}>Start</Text>
                  <TouchableOpacity 
                    style={styles.splitTimeButton}
                    onPress={() => {
                      setActiveSplitPicker('split1Start');
                      setPickerHour(split1StartTime.getHours());
                      setPickerMinute(split1StartTime.getMinutes());
                      setShowTimePicker(true);
                    }}>
                    <Text style={styles.splitTimeText}>
                      {format(split1StartTime, is24HourFormat ? 'HH:mm' : 'h:mm a')}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.splitTimeSeparator}>→</Text>
                
                <View style={styles.splitTimeItem}>
                  <Text style={styles.splitTimeItemLabel}>End</Text>
                  <TouchableOpacity 
                    style={styles.splitTimeButton}
                    onPress={() => {
                      setActiveSplitPicker('split1End');
                      setPickerHour(split1EndTime.getHours());
                      setPickerMinute(split1EndTime.getMinutes());
                      setShowTimePicker(true);
                    }}>
                    <Text style={styles.splitTimeText}>
                      {format(split1EndTime, is24HourFormat ? 'HH:mm' : 'h:mm a')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            {/* Shift 2 */}
            <View style={styles.splitShiftContainer}>
              <Text style={styles.splitShiftLabel}>Shift 2</Text>
              <View style={styles.splitTimeRow}>
                <View style={styles.splitTimeItem}>
                  <Text style={styles.splitTimeItemLabel}>Start</Text>
                  <TouchableOpacity 
                    style={styles.splitTimeButton}
                    onPress={() => {
                      setActiveSplitPicker('split2Start');
                      setPickerHour(split2StartTime.getHours());
                      setPickerMinute(split2StartTime.getMinutes());
                      setShowTimePicker(true);
                    }}>
                    <Text style={styles.splitTimeText}>
                      {format(split2StartTime, is24HourFormat ? 'HH:mm' : 'h:mm a')}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.splitTimeSeparator}>→</Text>
                
                <View style={styles.splitTimeItem}>
                  <Text style={styles.splitTimeItemLabel}>End</Text>
                  <TouchableOpacity 
                    style={styles.splitTimeButton}
                    onPress={() => {
                      setActiveSplitPicker('split2End');
                      setPickerHour(split2EndTime.getHours());
                      setPickerMinute(split2EndTime.getMinutes());
                      setShowTimePicker(true);
                    }}>
                    <Text style={styles.splitTimeText}>
                      {format(split2EndTime, is24HourFormat ? 'HH:mm' : 'h:mm a')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            <Text style={styles.splitTotalHours}>
              Total: {((split1EndTime.getTime() - split1StartTime.getTime() + split2EndTime.getTime() - split2StartTime.getTime()) / (1000 * 60 * 60)).toFixed(1)} hours
            </Text>
          </View>
        )}

        {/* Date Range Picker - For Holiday/OFF types */}
        {!requiresStartEndTime(shiftType) && (
          <View style={styles.section}>
            <Text style={styles.label}>Date Range</Text>
            <Text style={styles.helperText}>Select the start and end dates for this {shiftType === 'holiday' ? 'holiday' : 'time off'}</Text>
            
            {/* Start Date */}
            <View style={styles.dateRangeRow}>
              <View style={styles.dateRangeItem}>
                <Text style={styles.dateRangeLabel}>From</Text>
                {Platform.OS === 'web' ? (
                  <TextInput
                    style={styles.input}
                    value={format(holidayStartDate, 'yyyy-MM-dd')}
                    onChangeText={(text) => {
                      const date = new Date(text);
                      if (!isNaN(date.getTime())) {
                        setHolidayStartDate(date);
                        if (holidayEndDate < date) {
                          setHolidayEndDate(date);
                        }
                      }
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#6B7280"
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.dateRangeButton}
                    onPress={() => setShowStartDatePicker(true)}>
                    <Text style={styles.dateRangeText}>
                      📅 {format(holidayStartDate, 'MMM d, yyyy')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* End Date */}
              <View style={styles.dateRangeItem}>
                <Text style={styles.dateRangeLabel}>To</Text>
                {Platform.OS === 'web' ? (
                  <TextInput
                    style={styles.input}
                    value={format(holidayEndDate, 'yyyy-MM-dd')}
                    onChangeText={(text) => {
                      const date = new Date(text);
                      if (!isNaN(date.getTime()) && date >= holidayStartDate) {
                        setHolidayEndDate(date);
                      }
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#6B7280"
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.dateRangeButton}
                    onPress={() => setShowEndDatePicker(true)}>
                    <Text style={styles.dateRangeText}>
                      📅 {format(holidayEndDate, 'MMM d, yyyy')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            {/* Duration Display */}
            {holidayStartDate && holidayEndDate && (
              <Text style={styles.dateRangeDurationText}>
                Duration: {Math.ceil((holidayEndDate.getTime() - holidayStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} day(s)
              </Text>
            )}
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any additional details..."
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Pattern Toggle */}
        <View style={styles.section}>
          <View style={styles.patternHeader}>
            <View>
              <Text style={styles.label}>Repeat Pattern</Text>
              <Text style={styles.helperText}>Create recurring shifts automatically</Text>
            </View>
            <Switch
              value={usePattern}
              onValueChange={setUsePattern}
              trackColor={{false: '#374151', true: '#6366F1'}}
              thumbColor={'#FFFFFF'}
            />
          </View>

          {usePattern && (
            <View style={styles.patternContent}>
              <Text style={styles.patternSubtitle}>Select Pattern:</Text>
              <View style={styles.patternGrid}>
                {/* Simple Patterns */}
                {(Object.entries(SIMPLE_PATTERNS) as [keyof typeof SIMPLE_PATTERNS, typeof SIMPLE_PATTERNS[keyof typeof SIMPLE_PATTERNS]][]).map(([key, pattern]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.patternCard,
                      selectedPattern === key && !selectedCustomPattern && styles.patternCardActive,
                    ]}
                    onPress={() => {
                      setSelectedPattern(key);
                      setSelectedCustomPattern(null);
                    }}>
                    <Text style={[
                      styles.patternName,
                      selectedPattern === key && !selectedCustomPattern && styles.patternNameActive,
                    ]}>
                      {pattern.name}
                    </Text>
                    <Text style={[
                      styles.patternDesc,
                      selectedPattern === key && !selectedCustomPattern && styles.patternDescActive,
                    ]}>
                      {pattern.workDays} days on, {pattern.restDays} days off
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Custom Patterns */}
                {customPatterns.map((customPattern) => {
                  const workingDays = customPattern.cells.filter(c => c.shiftType !== null).length;
                  const daysOff = 14 - workingDays;
                  return (
                    <TouchableOpacity
                      key={customPattern.id}
                      style={[
                        styles.patternCard,
                        styles.patternCardCustom,
                        selectedCustomPattern?.id === customPattern.id && styles.patternCardActive,
                      ]}
                      onPress={() => {
                        setSelectedCustomPattern(customPattern);
                        setSelectedPattern(customPattern.id);
                      }}>
                      <Text style={[
                        styles.patternName,
                        selectedCustomPattern?.id === customPattern.id && styles.patternNameActive,
                      ]}>
                        ✨ {customPattern.name}
                      </Text>
                      <Text style={[
                        styles.patternDesc,
                        selectedCustomPattern?.id === customPattern.id && styles.patternDescActive,
                      ]}>
                        {workingDays} working days, {daysOff} days off
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.patternSubtitle}>Duration:</Text>
              <View style={styles.durationRow}>
                {[3, 6, 9, 12].map((months) => (
                  <TouchableOpacity
                    key={months}
                    style={[
                      styles.durationButton,
                      patternMonths === months && styles.durationButtonActive,
                    ]}
                    onPress={() => setPatternMonths(months)}>
                    <Text style={[
                      styles.durationText,
                      patternMonths === months && styles.durationTextActive,
                    ]}>
                      {months}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  ℹ️ Pattern will create shifts for {patternMonths} months starting from {format(startTime, 'MMM d')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {usePattern ? 'Create Pattern' : 'Create Shift'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Select {timePickerType === 'start' ? 'Start' : 'End'} Time
            </Text>
            
            <View style={styles.pickerContainer}>
              {/* Hour Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Hour</Text>
                <ScrollView 
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={false}>
                  {Array.from({length: 24}, (_, i) => i).map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.pickerItem,
                        pickerHour === hour && styles.pickerItemActive
                      ]}
                      onPress={() => setPickerHour(hour)}>
                      <Text style={[
                        styles.pickerItemText,
                        pickerHour === hour && styles.pickerItemTextActive
                      ]}>
                        {String(hour).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Minute Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Minute</Text>
                <ScrollView 
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={false}>
                  {Array.from({length: 12}, (_, i) => i * 5).map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.pickerItem,
                        pickerMinute === minute && styles.pickerItemActive
                      ]}
                      onPress={() => setPickerMinute(minute)}>
                      <Text style={[
                        styles.pickerItemText,
                        pickerMinute === minute && styles.pickerItemTextActive
                      ]}>
                        {String(minute).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={applyPickerTime}>
                <Text style={styles.modalSaveButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker for Holiday Start Date */}
      {showStartDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={holidayStartDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setHolidayStartDate(selectedDate);
              // If end date is before start date, update it
              if (holidayEndDate < selectedDate) {
                setHolidayEndDate(selectedDate);
              }
            }
          }}
        />
      )}

      {/* Date Picker for Holiday End Date */}
      {showEndDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={holidayEndDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={holidayStartDate}
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setHolidayEndDate(selectedDate);
            }
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
  },
  dateBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  dateText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  timeInputRow: {
    marginBottom: 12,
  },
  timeTextInput: {
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  timeHelperText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  quickSelectLabel: {
    fontSize: 13,
    color: '#A1A1AA',
    marginBottom: 8,
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeButton: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 70,
    alignItems: 'center',
  },
  timeButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  timeButtonText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  timeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  shiftTypeRow: {
    flexDirection: 'column',
    gap: 12,
  },
  shiftTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  shiftTypeButtonActive: {
    borderColor: '#FFFFFF',
  },
  shiftTypeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  shiftTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  checkmark: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  patternHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  patternContent: {
    marginTop: 16,
  },
  patternSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A1A1AA',
    marginBottom: 12,
  },
  patternGrid: {
    gap: 12,
    marginBottom: 20,
  },
  patternCard: {
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    padding: 16,
  },
  patternCardActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  patternCardCustom: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  patternName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  patternNameActive: {
    color: '#6366F1',
  },
  patternDesc: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  patternDescActive: {
    color: '#A1A1AA',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  durationButton: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  durationText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  durationTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  infoText: {
    fontSize: 13,
    color: '#A1A1AA',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formatToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  formatToggleActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  formatToggleText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  formatToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  ampmButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  ampmButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4B5563',
    minWidth: 50,
    alignItems: 'center',
  },
  dateRangeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dateRangeItem: {
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  dateRangeButton: {
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  dateRangeText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  dateRangeDurationText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  splitShiftContainer: {
    backgroundColor: '#1E1E2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  splitShiftLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  splitTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  splitTimeItem: {
    flex: 1,
  },
  splitTimeItemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 6,
  },
  splitTimeButton: {
    backgroundColor: '#0F0F23',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  splitTimeText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  splitTimeSeparator: {
    fontSize: 20,
    color: '#6366F1',
    fontWeight: '600',
    marginTop: 18,
  },
  splitTotalHours: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  ampmButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  ampmText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  ampmTextActive: {
    color: '#FFFFFF',
  },
  timePickerButton: {
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  timePickerText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  timePickerHint: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerScroll: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    backgroundColor: '#0F0F23',
  },
  pickerItem: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  pickerItemActive: {
    backgroundColor: '#6366F1',
  },
  pickerItemText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  pickerItemTextActive: {
    color: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalSaveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Conflict Modal Styles
  conflictModalContent: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  conflictModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  conflictModalText: {
    fontSize: 15,
    color: '#9CA3AF',
    marginBottom: 16,
    lineHeight: 22,
  },
  conflictModalQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  existingShiftCard: {
    backgroundColor: '#0F0F23',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  existingShiftTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  existingShiftTime: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  conflictButtonContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  conflictCancelButton: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  conflictCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  conflictKeepBothButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  conflictKeepBothButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  conflictReplaceButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  conflictReplaceButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
