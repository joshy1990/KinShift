import React, {useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CalendarStackParamList, Shift} from '@/types';
import {format, startOfWeek, addDays, isSameDay, isToday, startOfMonth, eachDayOfInterval, endOfDay} from 'date-fns';
import {shiftService} from '@/services/shift.service';
import {dayNoteService} from '@/services/dayNote.service';
import {householdService} from '@/services/household.service';
import {getShiftColor, analyzeMultiPersonShifts, generateMemberInitials, getHouseholdMemberColors} from '@/utils/shiftColors';
import {getScreenBottomPadding} from '@/utils/bottomSpacing';
import {useCurrentHouseholdId} from '@/contexts/HouseholdContext';
import {useAuth} from '@/contexts/AuthContext';
import {CalendarLegend} from '@/components/CalendarLegend';

type Props = NativeStackScreenProps<CalendarStackParamList, 'CalendarView'>;

export const CalendarViewScreen: React.FC<Props> = ({navigation}) => {
  const {user} = useAuth();
  const currentHouseholdId = useCurrentHouseholdId();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const {width: windowWidth} = useWindowDimensions();
  const dayColumnWidth = (windowWidth - 40) / 7;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [users, setUsers] = useState<Record<string, {name: string; email: string}>>({});
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [lastTapDate, setLastTapDate] = useState<Date | null>(null);
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  const isNavigatingRef = useRef(false);

  // Debounce currentDate for Firestore subscriptions (prevents listener churn on rapid swipes)
  const [debouncedDate, setDebouncedDate] = useState(new Date());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedDate(currentDate), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [currentDate]);

  // Header right button — export
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('CalendarExport')}
          style={{paddingHorizontal: 12, paddingVertical: 6}}
          accessibilityLabel="Export calendar"
          accessibilityRole="button">
          <Text style={{fontSize: 16, color: '#6366F1'}}>📤 Export</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);
  
  // Memoize expensive date calculations (for UI — instant updates)
  const weekDates = useMemo(() => {
    const start = startOfWeek(currentDate, {weekStartsOn: 1}); // Monday = 1
    return Array.from({length: 7}, (_, i) => addDays(start, i));
  }, [currentDate]);

  const monthDates = useMemo(() => {
    const start = startOfMonth(currentDate);
    const startDate = startOfWeek(start, {weekStartsOn: 1});
    const endDate = addDays(startDate, 41); // 6 weeks = 42 days
    
    return eachDayOfInterval({start: startDate, end: endDate});
  }, [currentDate]);

  const displayDates = useMemo(() => 
    viewMode === 'month' ? monthDates : weekDates,
    [viewMode, monthDates, weekDates]
  );

  // Debounced date ranges — only used for Firestore subscriptions to avoid listener churn
  const debouncedWeekDates = useMemo(() => {
    const start = startOfWeek(debouncedDate, {weekStartsOn: 1});
    return Array.from({length: 7}, (_, i) => addDays(start, i));
  }, [debouncedDate]);

  const debouncedMonthDates = useMemo(() => {
    const start = startOfMonth(debouncedDate);
    const startDate = startOfWeek(start, {weekStartsOn: 1});
    const endDate = addDays(startDate, 41);
    return eachDayOfInterval({start: startDate, end: endDate});
  }, [debouncedDate]);

  // Compute unique short initials for each household member (handles name collisions)
  const memberInitials = useMemo(() => {
    if (!user?.id) return {};
    return generateMemberInitials(users, user.id);
  }, [users, user?.id]);

  // Compute member color info for the legend
  const householdMemberColors = useMemo(() => {
    if (!user?.id || !currentHouseholdId) return [];
    return getHouseholdMemberColors(users, user.id);
  }, [users, user?.id, currentHouseholdId]);

  // Memoize navigation function
  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      // Navigate by month
      const newDate = new Date(currentDate);
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
      setCurrentDate(newDate);
    } else {
      // Navigate by week
      const newDate = addDays(currentDate, direction === 'next' ? 7 : -7);
      setCurrentDate(newDate);
    }
  }, [currentDate, viewMode]);

  // Memoize shift filtering functions
  const getShiftsForDate = useCallback((date: Date) => {
    const filtered = shifts.filter(shift => {
      // Handle Firestore Timestamp objects
      let shiftDate: Date;
      if (shift.startTime && typeof shift.startTime === 'object' && 'seconds' in shift.startTime) {
        shiftDate = new Date((shift.startTime as any).seconds * 1000);
      } else {
        shiftDate = new Date(shift.startTime);
      }
      return isSameDay(shiftDate, date);
    });
    
    return filtered;
  }, [shifts]);

  const getUsersWorkingOnDate = useCallback((date: Date) => {
    const dayShifts = getShiftsForDate(date);
    const uniqueUsers = new Set(dayShifts.map(s => s.ownerId));
    return Array.from(uniqueUsers);
  }, [getShiftsForDate]);

  const getDateColorIndicators = useCallback((date: Date) => {
    if (!user) return { colors: [], count: 0 };
    
    const dayShifts = getShiftsForDate(date);
    
    if (dayShifts.length === 0) {
      return { colors: [], count: 0 };
    }
    
    const shiftInfo = analyzeMultiPersonShifts(dayShifts, user.id);
    
    return {
      colors: shiftInfo.colors,
      count: shiftInfo.workingCount,
      displayStrategy: shiftInfo.displayStrategy,
    };
  }, [getShiftsForDate, user]);

  // Set up real-time data listeners and sample data
  useEffect(() => {
    let unsubscribeShifts: (() => void) | undefined;
    
    // Work in personal mode if no household selected
    if (!currentHouseholdId) {
      // Set current user as the only user
      if (user) {
        setUsers({
          [user.id]: {name: user.name, email: user.email}
        });

        // Set up real-time listener for personal shifts (load all, filter in UI)
        
        try {
          unsubscribeShifts = shiftService.subscribeToShifts(
            {
              ownerId: user.id,
              // No date filters - load all shifts and let UI filter by visible dates
            },
            (updatedShifts: Shift[]) => {
              // Ensure all shifts have valid shiftType (set default if missing)
              const shiftsWithTypes = updatedShifts.map(shift => ({
                ...shift,
                shiftType: shift.shiftType || 'custom',
              }));
              setShifts(shiftsWithTypes);
            },
            (error) => {
              console.error('Failed to load shifts:', error);
              // Don't clear shifts on error - let previously loaded shifts display
              // This prevents momentary color flicker when index errors occur
            }
          );
        } catch (error) {
          console.error('Failed to subscribe to personal shifts:', error);
          setShifts([]);
        }
      }

      // Load note counts for personal mode (must run regardless of shift subscription)
      const loadPersonalNoteCounts = async () => {
        try {
          if (!user) return;
          const dates = viewMode === 'month' ? debouncedMonthDates : debouncedWeekDates;
          console.log('[Calendar] Loading personal note counts for', dates.length, 'dates');
          const counts = await dayNoteService.getNoteCounts(user.id, dates, true);
          console.log('[Calendar] Personal note counts:', JSON.stringify(counts));
          setNoteCounts(counts);
        } catch (error) {
          console.error('Failed to load personal note counts:', error);
        }
      };
      loadPersonalNoteCounts();

      return () => {
        if (unsubscribeShifts) unsubscribeShifts();
      };
    }
    // Household mode
    
    // Load household members and set up shifts listener
    const loadHouseholdData = async () => {
      try {
        const members = await householdService.getHouseholdMembers(currentHouseholdId!);
        const usersMap: Record<string, {name: string; email: string}> = {};
        
        members.forEach(member => {
          usersMap[member.userId] = {
            name: member.name || `${member.email?.split('@')[0] || 'Unknown'}`,
            email: member.email || ''
          };
        });
        
        setUsers(usersMap);
        
        // Now set up shifts listener with the current users map (uses debounced dates to avoid churn)
        const startDate = viewMode === 'month' ? debouncedMonthDates[0] : debouncedWeekDates[0];
        const lastDate = viewMode === 'month' ? debouncedMonthDates[debouncedMonthDates.length - 1] : debouncedWeekDates[debouncedWeekDates.length - 1];
        const endDate = endOfDay(lastDate);
        
        try {
          unsubscribeShifts = shiftService.listenToHouseholdShifts(
            currentHouseholdId,
            startDate,
            endDate,
            (updatedShifts: Shift[]) => {
              // Filter out shifts from users who are no longer in the household
              const filteredShifts = updatedShifts.filter(shift => {
                return !!usersMap[shift.ownerId];
              });
              
              // Ensure all shifts have valid shiftType (set default if missing)
              const shiftsWithTypes = filteredShifts.map(shift => ({
                ...shift,
                shiftType: shift.shiftType || 'custom',
              }));
              
              setShifts(shiftsWithTypes);
            }
          );
        } catch (error) {
          console.error('Failed to subscribe to household shifts:', error);
          // Don't clear shifts on error - let previously loaded shifts display
          // This prevents momentary color flicker when index errors occur
        }
      } catch (error) {
        console.error('Failed to load household members:', error);
        setUsers({});
      }
    };
    
    loadHouseholdData();
    
    // Load note counts (using debounced dates to avoid churn)
    const loadNoteCounts = async () => {
      try {
        const dates = viewMode === 'month' ? debouncedMonthDates : debouncedWeekDates;
        console.log('[Calendar] Loading household note counts for', dates.length, 'dates, householdId:', currentHouseholdId);
        const counts = await dayNoteService.getNoteCounts(
          currentHouseholdId,
          dates,
          false,
          user?.id
        );
        console.log('[Calendar] Household note counts:', JSON.stringify(counts));
        setNoteCounts(counts);
      } catch (error) {
        console.error('Failed to load note counts:', error);
      }
    };
    loadNoteCounts();

    // Cleanup listener on unmount
    return () => {
      if (unsubscribeShifts) {
        unsubscribeShifts();
      }
    };
  }, [debouncedDate, currentHouseholdId, viewMode, user, debouncedWeekDates, debouncedMonthDates, isFocused]); // Debounced deps prevent listener churn; isFocused triggers refresh on return

  // Handle date press with double-tap detection
  const handleDatePress = (date: Date, dateString: string) => {
    const now = Date.now();
    const isDoubleTap = lastTapDate && isSameDay(lastTapDate, date) && now - lastTapTime < 300;

    if (isDoubleTap) {
      // Guard against rapid re-navigation
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      setTimeout(() => { isNavigatingRef.current = false; }, 1000);

      // Double tap - navigate to day detail with shifts for that day
      const dayShifts = getShiftsForDate(date);
      navigation.navigate('DayDetail', {
        date: dateString,
        shifts: dayShifts,
      });
      setLastTapDate(null);
      setLastTapTime(0);
    } else {
      // Single tap - just highlight
      setSelectedDate(date);
      setLastTapDate(date);
      setLastTapTime(now);
    }
  };

  // Render month view cell (compact)
  const renderMonthCell = ({item: date}: {item: Date}) => {
    const dayShifts = getShiftsForDate(date);
    const workingUsers = getUsersWorkingOnDate(date);
    const colorInfo = getDateColorIndicators(date);
    const isSelected = isSameDay(date, selectedDate);
    const isCurrentDay = isToday(date);
    const dateString = format(date, 'yyyy-MM-dd');
    const noteCount = noteCounts[dateString] || 0;
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();

    return (
      <TouchableOpacity
        style={[
          styles.monthCell,
          isSelected && styles.selectedMonthCell,
          !isCurrentMonth && styles.otherMonthCell,
        ]}
        onPress={() => handleDatePress(date, dateString)}>
        <View style={[
          styles.monthCellHeader,
          isCurrentDay && styles.todayHeader,
        ]}>
          <Text style={[
            styles.monthCellNumber,
            isCurrentDay && styles.todayText,
            !isCurrentMonth && styles.otherMonthText,
          ]}>
            {format(date, 'd')}
          </Text>
          {noteCount > 0 && (
            <View style={styles.monthNoteDot} />
          )}
        </View>
        
        {/* Shift indicators (dense): show up to 2 owner dots, and a small digit for total if > 2 */}
        {colorInfo.count > 0 && (
          <View style={styles.monthShiftIndicators}>
            {(() => {
              // If exactly one shift with a label, keep the label badge
              if (dayShifts.length === 1 && dayShifts[0].label) {
                const isCurrent = dayShifts[0].ownerId === user?.id;
                const badgeColor = getShiftColor(dayShifts[0], user?.id || '', isCurrent);
                return (
                  <View style={[styles.shiftLabelBadge, { backgroundColor: badgeColor || '#6366F1' }]}>
                    <Text style={styles.shiftLabelText}>{dayShifts[0].label}</Text>
                  </View>
                );
              }

              // Build owner -> latest shift map
              const owners = workingUsers;
              const byOwner: Record<string, Shift | undefined> = {};
              owners.forEach(ownerId => {
                const ownerShifts = dayShifts.filter(s => s.ownerId === ownerId);
                ownerShifts.sort((a, b) => {
                  const aTime = a.startTime && typeof a.startTime === 'object' && 'seconds' in a.startTime
                    ? (a.startTime as any).seconds * 1000
                    : new Date(a.startTime).getTime();
                  const bTime = b.startTime && typeof b.startTime === 'object' && 'seconds' in b.startTime
                    ? (b.startTime as any).seconds * 1000
                    : new Date(b.startTime).getTime();
                  return bTime - aTime;
                });
                byOwner[ownerId] = ownerShifts[0];
              });

              // Choose up to two owners, prioritizing current user
              const ownersToDisplay: string[] = [];
              const currentUserId = user?.id;
              if (currentUserId && owners.includes(currentUserId)) {
                ownersToDisplay.push(currentUserId);
              }
              for (const ownerId of owners) {
                if (ownersToDisplay.length >= 2) break;
                if (!currentUserId || ownerId !== currentUserId) {
                  ownersToDisplay.push(ownerId);
                }
              }

              const totalOwners = owners.length;

              return (
                <View style={styles.monthOwnerDotsRow}>
                  {ownersToDisplay.map((ownerId, idx) => {
                    const latest = byOwner[ownerId];
                    if (!latest) return null;
                    const isCurrent = ownerId === currentUserId;
                    const color = getShiftColor(latest, currentUserId || '', isCurrent);
                    return (
                      <View
                        key={`${ownerId}-${idx}`}
                        style={[
                          styles.monthOwnerDot,
                          { backgroundColor: color },
                          isCurrent && styles.monthOwnerDotOwn,
                        ]}
                      />
                    );
                  })}
                  {totalOwners > 2 && (
                    <Text style={styles.monthCountDigit}>{totalOwners}</Text>
                  )}
                </View>
              );
            })()}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderDayColumn = ({item: date}: {item: Date}) => {
    const dayShifts = getShiftsForDate(date);
    const colorInfo = getDateColorIndicators(date);
    const isSelected = isSameDay(date, selectedDate);
    const isCurrentDay = isToday(date);
    const dateString = format(date, 'yyyy-MM-dd');
    const noteCount = noteCounts[dateString] || 0;

    // Helper to get user initials for display (uses precomputed unique initials)
    const getUserInitialsForShift = (shiftOwnerId: string): string => {
      return memberInitials[shiftOwnerId] || '?';
    };

    return (
      <TouchableOpacity
        style={[
          styles.dayColumn,
          {width: dayColumnWidth},
          isSelected && styles.selectedDayColumn,
        ]}
        onPress={() => handleDatePress(date, dateString)}>
        <View style={[
          styles.dayHeader,
          isCurrentDay && styles.todayHeader,
        ]}>
          <Text style={[
            styles.dayName,
            isCurrentDay && styles.todayText,
          ]}>
            {format(date, 'EEE')}
          </Text>
          <View style={styles.dayNumberContainer}>
            <Text style={[
              styles.dayNumber,
              isCurrentDay && styles.todayText,
            ]}>
              {format(date, 'd')}
            </Text>
            {noteCount > 0 && (
              <View style={styles.noteBadge}>
                <Text style={styles.noteBadgeText}>{noteCount}</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.shiftsContainer}>
          {colorInfo.count === 0 ? (
            <View style={styles.emptyDay}>
              <Text style={styles.emptyDayText}>No shifts</Text>
            </View>
          ) : (
            // Show all users grouped by user - each user on own line
            <View style={styles.weekColorBlocks}>
              {(() => {
                const owners = getUsersWorkingOnDate(date);
                const currentUserId = user?.id;
                
                // Sort owners: current user first, then others
                const sortedOwners = owners.sort((a, b) => {
                  if (a === currentUserId) return -1;
                  if (b === currentUserId) return 1;
                  return 0;
                });

                return (
                  <View style={styles.userShiftRow}>
                    {/* All users in one row */}
                    {sortedOwners.map((ownerId) => {
                      const ownerShifts = dayShifts.filter(s => s.ownerId === ownerId);
                      if (ownerShifts.length === 0) return null;
                      
                      // Get color from first shift
                      const isCurrent = ownerId === currentUserId;
                      const color = getShiftColor(ownerShifts[0], currentUserId || '', isCurrent);
                      
                      return (
                        <View key={`user-${ownerId}`}>
                          {/* User shifts */}
                          {ownerShifts.map((shift, idx) => {
                            // Convert various time formats to Date
                            let shiftDate: Date | null = null;
                            if (shift.startTime) {
                              if (shift.startTime instanceof Date) {
                                shiftDate = shift.startTime;
                              } else if (typeof shift.startTime === 'object' && 'seconds' in shift.startTime) {
                                // Firestore Timestamp
                                shiftDate = new Date((shift.startTime as any).seconds * 1000);

                          } else if (typeof shift.startTime === 'string') {
                            shiftDate = new Date(shift.startTime);
                          } else if (typeof shift.startTime === 'number') {
                            shiftDate = new Date(shift.startTime);
                          }
                        }
                        
                        const timeString = shiftDate && !isNaN(shiftDate.getTime()) 
                          ? format(shiftDate, 'HH:mm')
                          : '--:--';
                        
                        return (
                          <View
                            key={`${ownerId}-shift-${idx}`}
                            style={[styles.userShiftLabel, { backgroundColor: color }]}>
                            <View style={styles.shiftLabelContent}>
                              <Text style={styles.shiftInitials}>
                                {getUserInitialsForShift(ownerId)}
                              </Text>
                              <Text style={styles.shiftTimeInline}>
                                {timeString}
                              </Text>
                            </View>
                            {isCurrent && (
                              <View style={styles.ownShiftIndicator} />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                    })}
                  </View>
                );
              })()}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header with navigation */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigateWeek('prev')}
          accessible={true}
          accessibilityLabel={`Go to previous ${viewMode}`}
          accessibilityRole="button"
          accessibilityHint={`Navigate to ${viewMode === 'month' ? 'previous month' : 'previous week'}`}>
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.monthYear}>
            {format(currentDate, 'MMMM yyyy')}
          </Text>
          <View style={styles.viewModeSelector}>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === 'week' && styles.activeViewMode,
              ]}
              onPress={() => setViewMode('week')}
              accessible={true}
              accessibilityLabel="Week view"
              accessibilityRole="button"
              accessibilityState={{selected: viewMode === 'week'}}
              accessibilityHint="Switch to week view">
              <Text style={[
                styles.viewModeText,
                viewMode === 'week' && styles.activeViewModeText,
              ]}>
                Week
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === 'month' && styles.activeViewMode,
              ]}
              onPress={() => setViewMode('month')}
              accessible={true}
              accessibilityLabel="Month view"
              accessibilityRole="button"
              accessibilityState={{selected: viewMode === 'month'}}
              accessibilityHint="Switch to month view">
              <Text style={[
                styles.viewModeText,
                viewMode === 'month' && styles.activeViewModeText,
              ]}>
                Month
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigateWeek('next')}
          accessible={true}
          accessibilityLabel={`Go to next ${viewMode}`}
          accessibilityRole="button"
          accessibilityHint={`Navigate to ${viewMode === 'month' ? 'next month' : 'next week'}`}>
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarContainer}>
        {viewMode === 'month' ? (
          <>
            {/* Month view header */}
            <View style={styles.monthHeaderRow}>
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                <View key={day} style={styles.monthHeaderCell}>
                  <Text style={styles.monthHeaderText}>{day}</Text>
                </View>
              ))}
            </View>
            {/* Month grid */}
            <FlatList
              data={displayDates}
              renderItem={renderMonthCell}
              keyExtractor={item => item.toISOString()}
              numColumns={7}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.monthGrid,
                {paddingBottom: getScreenBottomPadding(insets.bottom)}
              ]}
            />
          </>
        ) : (
          <FlatList
            data={displayDates}
            renderItem={renderDayColumn}
            keyExtractor={item => item.toISOString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.weekContainer,
              {paddingBottom: getScreenBottomPadding(insets.bottom)}
            ]}
          />
        )}
      </View>

      {/* Calendar Legend */}
      <CalendarLegend defaultExpanded={false} householdMembers={householdMemberColors} />

      {/* Add Shift Button */}
      <TouchableOpacity
        style={[
          styles.addButton,
          {marginBottom: Math.max(20, insets.bottom + 10)}, // Ensure button stays above navigation bar
        ]}
        onPress={() => navigation.navigate('AddShift', {
          date: selectedDate,
        })}
        accessible={true}
        accessibilityLabel="Add new shift"
        accessibilityRole="button"
        accessibilityHint={`Create a new shift for ${format(selectedDate, 'MMMM d, yyyy')}`}>
        <Text style={styles.addButtonText}>+ Add Shift</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C3E',
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  monthYear: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  viewModeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  viewModeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeViewMode: {
    backgroundColor: '#6366F1',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  activeViewModeText: {
    color: '#FFFFFF',
  },
  calendarContainer: {
    flex: 1,
  },
  weekContainer: {
    paddingHorizontal: 10,
  },
  dayColumn: {
    marginHorizontal: 2,
    backgroundColor: '#1A1A2E',
  },
  selectedDayColumn: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  dayHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C3E',
  },
  todayHeader: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A1A1AA',
    textTransform: 'uppercase',
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
  todayText: {
    color: '#FFFFFF',
  },
  shiftsContainer: {
    minHeight: 90,
    paddingVertical: 12,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  emptyDay: {
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDayText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  weekColorBlocks: {
    width: '100%',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  userShiftLabel: {
    width: 50,
    height: 50,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 8,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 0,
    flexShrink: 0,
  },
  shiftLabelContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    flex: 1,
    paddingTop: 6,
  },
  shiftTimeInline: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.95,
    lineHeight: 11,
    paddingBottom: 4,
  },
  userShiftsList: {
    flexDirection: 'row',
    gap: 3,
    flex: 1,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  weekColorBlock: {
    height: 60,
    borderRadius: 8,
    width: '100%',
  },
  weekColorBlockWithInitials: {
    height: 36,
    borderRadius: 8,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  shiftInitials: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 13,
  },
  ownShiftIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    marginTop: 'auto',
  },
  weekMultiPersonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekMultiPersonBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  weekMultiPersonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  shiftCard: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  shiftTypeIndicator: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  shiftTypeIcon: {
    fontSize: 12,
  },
  userInitials: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  initialsText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  shiftTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  shiftTime: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.9,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#6366F1',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dayNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBadgeText: {
    color: '#0F0F23',
    fontSize: 10,
    fontWeight: 'bold',
  },
  multiPersonCard: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  splitColorContainer: {
    flexDirection: 'row',
    height: 30,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  splitColorHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitInitials: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  multiPersonText: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.9,
    fontWeight: '500',
    textAlign: 'center',
  },
  multiPersonBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  multiPersonBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  quickActionsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#6366F1',
    borderRadius: 8,
    marginRight: 8,
  },
  quickActionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Month view styles
  monthHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
    paddingVertical: 8,
  },
  monthHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  monthHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  monthGrid: {
    padding: 4,
  },
  monthCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 4,
    borderWidth: 0.5,
    borderColor: '#2A2A3E',
    backgroundColor: '#1A1A2E',
  },
  selectedMonthCell: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366F1',
  },
  otherMonthCell: {
    backgroundColor: '#0F0F23',
    opacity: 0.5,
  },
  monthCellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  monthCellNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  otherMonthText: {
    color: '#6B7280',
  },
  monthNoteDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  monthShiftIndicators: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  colorBlocksRow: {
    flexDirection: 'row',
    width: '100%',
    height: 8,
    gap: 2,
  },
  colorBlock: {
    flex: 1,
    borderRadius: 2,
    minWidth: 8,
  },
  colorBlockFull: {
    width: '100%',
  },
  monthShiftDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  monthShiftMore: {
    fontSize: 8,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  monthOwnerDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthOwnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  monthOwnerDotOwn: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  monthCountDigit: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  shiftLabelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
