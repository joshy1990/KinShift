import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarStackParamList, Shift, DayNote } from '@/types';
import { format, isSameDay } from 'date-fns';
import { shiftService } from '@/services/shift.service';
import { dayNoteService } from '@/services/dayNote.service';
import { householdService } from '@/services/household.service';
import { getShiftTypeIcon, getShiftColor } from '@/utils/shiftColors';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentHouseholdId } from '@/contexts/HouseholdContext';
import { showError, showSuccess, showConfirm } from '@/utils/alert';

type Props = NativeStackScreenProps<CalendarStackParamList, 'DayDetail'>;

export const DayDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { date, shifts: passedShifts } = route.params;
  const { user } = useAuth();
  const currentHouseholdId = useCurrentHouseholdId();
  const [shifts, setShifts] = useState<Shift[]>(passedShifts || []);
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [users, setUsers] = useState<Record<string, { name: string; email: string }>>({});
  const usersRef = useRef<Record<string, { name: string; email: string }>>({});
  const [loading, setLoading] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteTime, setNoteTime] = useState<Date | null>(null);
  const [noteTimeText, setNoteTimeText] = useState<string>(''); // Web input text for time
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [noteCategory, setNoteCategory] = useState<DayNote['category']>('other');
  const [notifyWorking, setNotifyWorking] = useState(true);
  const [saving, setSaving] = useState(false);

  const dateObj = new Date(date);
  const dateString = format(dateObj, 'yyyy-MM-dd');

  // Helper to get user name from ID
  const getUserName = (userId: string): string => {
    return users[userId]?.name || 'Unknown User';
  };

  useEffect(() => {
    loadDayData();
    
    // Skip real-time subscriptions if no user
    if (!user) {
      return;
    }

    const isPersonalMode = !currentHouseholdId;
    let unsubscribeShifts: (() => void) | undefined;
    let unsubscribeNotes: (() => void) | undefined;
    
    try {
      // Subscribe to real-time shifts updates
      if (isPersonalMode) {
        unsubscribeShifts = shiftService.subscribeToShifts(
          {
            ownerId: user.id,
            // No date filter - we filter in the callback
          },
          (updatedShifts) => {
            // Filter to only THIS DATE
            const shiftsOnThisDate = updatedShifts.filter(shift => {
              const shiftDate = shift.startTime && typeof shift.startTime === 'object' && 'seconds' in shift.startTime
                ? new Date((shift.startTime as any).seconds * 1000)
                : new Date(shift.startTime);
              return isSameDay(shiftDate, dateObj);
            });
            setShifts(shiftsOnThisDate);
          }
        );
      } else if (currentHouseholdId) {
        // Household mode - subscribe to shifts for this household
        unsubscribeShifts = shiftService.subscribeToShifts(
          {
            householdId: currentHouseholdId,
            // No date filter - we filter in the callback
          },
          (updatedShifts) => {
            // Filter to only THIS DATE and users in household
            const shiftsOnThisDate = updatedShifts.filter(shift => {
              const shiftDate = shift.startTime && typeof shift.startTime === 'object' && 'seconds' in shift.startTime
                ? new Date((shift.startTime as any).seconds * 1000)
                : new Date(shift.startTime);
              const isOnThisDate = isSameDay(shiftDate, dateObj);
              const isUserInHousehold = !!usersRef.current[shift.ownerId];
              return isOnThisDate && isUserInHousehold;
            });
            setShifts(shiftsOnThisDate);
          }
        );
        
        // Subscribe to real-time notes updates (household mode only)
        unsubscribeNotes = dayNoteService.subscribeToDateNotes(
          currentHouseholdId,
          dateObj,
          (updatedNotes) => {
            setNotes(updatedNotes);
          }
        );
      }
    } catch (error) {
      console.error('Failed to subscribe to real-time updates:', error);
    }

    return () => {
      if (unsubscribeShifts) unsubscribeShifts();
      if (unsubscribeNotes) unsubscribeNotes();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, currentHouseholdId, user]);

  const loadDayData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const isPersonalMode = !currentHouseholdId;
      
      // Set up users
      if (isPersonalMode) {
        // Personal mode - only show current user
        const personalUsers = {
          [user.id]: { name: user.name || 'You', email: user.email || '' }
        };
        setUsers(personalUsers);
        usersRef.current = personalUsers;
      } else {
        // Household mode - fetch real household members
        try {
          const members = await householdService.getHouseholdMembers(currentHouseholdId!);
          const usersMap: Record<string, { name: string; email: string }> = {};
          
          members.forEach(member => {
            usersMap[member.userId] = {
              name: member.name || `${member.email?.split('@')[0] || 'Unknown'}`,
              email: member.email || ''
            };
          });
          
          // Add current user if not in household data
          if (!usersMap[user.id]) {
            usersMap[user.id] = { name: user.name || 'You', email: user.email || '' };
          }
          
          setUsers(usersMap);
          usersRef.current = usersMap;
        } catch (userError) {
          console.warn('Failed to load household members, using current user only:', userError);
          const fallbackUsers = { [user.id]: { name: user.name || 'You', email: user.email || '' } };
          setUsers(fallbackUsers);
          usersRef.current = fallbackUsers;
        }
      }
      
      // Load shifts for this day
      let dayShifts: Shift[] = passedShifts || [];
      try {
        if (!passedShifts || passedShifts.length === 0) {
          if (isPersonalMode) {
            const result = await shiftService.getShifts({ 
              ownerId: user.id, 
              startDate: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0),
              endDate: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59)
            });
            dayShifts = result.shifts;
          } else {
            dayShifts = await shiftService.getHouseholdShifts(
              currentHouseholdId!, 
              new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0),
              new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59)
            );
          }
        }
      } catch (shiftError) {
        console.warn('Failed to load shifts, using passed data:', shiftError);
      }
      
      // Get notes - personal mode or household mode
      let dayNotes: DayNote[] = [];
      try {
        dayNotes = isPersonalMode
          ? await dayNoteService.getNotesByDate(user.id, dateObj, true) // Personal notes
          : await dayNoteService.getNotesByDate(currentHouseholdId!, dateObj, false); // Household notes
      } catch (noteError) {
        console.warn('Failed to load notes:', noteError);
      }

      setShifts(dayShifts);
      setNotes(dayNotes);
    } catch (error) {
      console.error('Failed to load day data:', error);
      // Don't show error popup — real-time subscriptions will provide the data
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) {
      showError('Please enter note content');
      return;
    }

    if (!user) {
      showError('You must be logged in to add notes');
      return;
    }

    const isPersonalMode = !currentHouseholdId;

    setSaving(true);

    // Optimistic save — Firestore caches writes locally so data is available
    // immediately via real-time listeners even if server ACK is slow
    let didTimeout = false;
    const optimisticTimeout = setTimeout(() => {
      didTimeout = true;
      setSaving(false);
      // Reset form optimistically
      setNoteContent('');
      setNoteTime(null);
      setNoteTimeText('');
      setNoteCategory('other');
      setNotifyWorking(true);
      setShowAddNote(false);
      showSuccess('Note saved! It will sync when connection improves.');
    }, 8000);

    try {
      await dayNoteService.createNote({
        householdId: currentHouseholdId || undefined, // undefined for personal notes
        date: dateString,
        authorId: user.id,
        authorName: user.name || 'User',
        content: noteContent.trim(),
        time: noteTime ? format(noteTime, 'HH:mm') : undefined,
        category: noteCategory,
        notifyWorkingMembers: isPersonalMode ? false : notifyWorking, // No notifications in personal mode
      });

      if (!didTimeout) {
        clearTimeout(optimisticTimeout);
        // Reset form
        setNoteContent('');
        setNoteTime(null);
        setNoteTimeText('');
        setNoteCategory('other');
        setNotifyWorking(true);
        setShowAddNote(false);

        // Reload data to show new note
        await loadDayData();

        showSuccess('Note added successfully!' + (notifyWorking ? '\n\nWorking members have been notified.' : ''));
      }
    } catch (error) {
      if (!didTimeout) {
        clearTimeout(optimisticTimeout);
        console.error('Failed to add note:', error);
        showError('Failed to add note');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (shift: Shift) => {
    if (!user) {
      showError('You must be logged in to delete shifts');
      return;
    }

    // Confirm deletion
    showConfirm(
      'Delete Shift',
      `Are you sure you want to delete "${shift.title}"?`,
      async () => {
        try {
          await shiftService.deleteShift(shift.id, user.id);
          showSuccess('Shift deleted successfully');
          // The real-time subscription will automatically update the UI
        } catch (error) {
          console.error('Failed to delete shift:', error);
          showError('Failed to delete shift');
        }
      }
    );
  };

  const handleDeleteNote = async (noteId: string) => {
    showConfirm(
      'Delete Note',
      'Are you sure you want to delete this note?',
      async () => {
        try {
          await dayNoteService.deleteNote(noteId, user!.id, currentHouseholdId);
          await loadDayData();
        } catch (error) {
          showError('Failed to delete note');
        }
      }
    );
  };

  const getCategoryIcon = (category?: DayNote['category']) => {
    switch (category) {
      case 'appointment':
        return '🏥';
      case 'event':
        return '🎉';
      case 'reminder':
        return '⏰';
      case 'childcare':
        return '👶';
      default:
        return '📝';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
    <KeyboardAvoidingView
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.dateTitle}>{format(dateObj, 'EEEE, MMMM d, yyyy')}</Text>
        <Text style={styles.dateSubtitle}>
          {shifts.length} {shifts.length === 1 ? 'shift' : 'shifts'} · {notes.length}{' '}
          {notes.length === 1 ? 'note' : 'notes'}
        </Text>
      </View>

      {/* Shifts Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shifts</Text>
        {shifts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No shifts scheduled</Text>
          </View>
        ) : (
          shifts.map((shift) => (
            <View key={shift.id} style={styles.shiftCard}>
              <View
                style={[
                  styles.shiftColorBar,
                  { backgroundColor: getShiftColor(shift, user?.id || '', shift.ownerId === user?.id) },
                ]}
              />
              <View style={styles.shiftContent}>
                <View style={styles.shiftHeader}>
                  <Text style={styles.shiftIcon}>{getShiftTypeIcon(shift.shiftType)}</Text>
                  <View style={styles.shiftInfo}>
                    <Text style={styles.shiftTitle}>{shift.title}</Text>
                    <Text style={styles.shiftOwner}>👤 {getUserName(shift.ownerId)}</Text>
                  </View>
                </View>
                
                {/* Display time(s) - different format for split shifts */}
                {shift.shiftType === 'split' && shift.splitTimes && shift.splitTimes.length === 2 ? (
                  // Split shift - show BOTH time ranges
                  <View style={styles.splitTimesContainer}>
                    <Text style={styles.splitShiftLabel}>🕐 SPLIT SHIFT</Text>
                    <Text style={styles.shiftTime}>
                      {format(
                        shift.splitTimes[0].startTime && typeof shift.splitTimes[0].startTime === 'object' && 'seconds' in shift.splitTimes[0].startTime
                          ? new Date((shift.splitTimes[0].startTime as any).seconds * 1000)
                          : new Date(shift.splitTimes[0].startTime),
                        'h:mm a'
                      )} -{' '}
                      {format(
                        shift.splitTimes[0].endTime && typeof shift.splitTimes[0].endTime === 'object' && 'seconds' in shift.splitTimes[0].endTime
                          ? new Date((shift.splitTimes[0].endTime as any).seconds * 1000)
                          : new Date(shift.splitTimes[0].endTime),
                        'h:mm a'
                      )}
                    </Text>
                    <Text style={styles.shiftTime}>
                      {format(
                        shift.splitTimes[1].startTime && typeof shift.splitTimes[1].startTime === 'object' && 'seconds' in shift.splitTimes[1].startTime
                          ? new Date((shift.splitTimes[1].startTime as any).seconds * 1000)
                          : new Date(shift.splitTimes[1].startTime),
                        'h:mm a'
                      )} -{' '}
                      {format(
                        shift.splitTimes[1].endTime && typeof shift.splitTimes[1].endTime === 'object' && 'seconds' in shift.splitTimes[1].endTime
                          ? new Date((shift.splitTimes[1].endTime as any).seconds * 1000)
                          : new Date(shift.splitTimes[1].endTime),
                        'h:mm a'
                      )}
                    </Text>
                  </View>
                ) : (
                  // Normal shift - single time range
                  <Text style={styles.shiftTime}>
                    🕐 {format(
                      shift.startTime && typeof shift.startTime === 'object' && 'seconds' in shift.startTime
                        ? new Date((shift.startTime as any).seconds * 1000)
                        : new Date(shift.startTime),
                      'h:mm a'
                    )} -{' '}
                    {format(
                      shift.endTime && typeof shift.endTime === 'object' && 'seconds' in shift.endTime
                        ? new Date((shift.endTime as any).seconds * 1000)
                        : new Date(shift.endTime),
                      'h:mm a'
                    )}
                  </Text>
                )}
                
                {shift.notes && <Text style={styles.shiftNotes}>📝 {shift.notes}</Text>}
                
                {/* Delete Button - only show if user owns the shift */}
                {user && shift.ownerId === user.id && (
                  <TouchableOpacity
                    style={styles.deleteShiftButton}
                    onPress={() => handleDeleteShift(shift)}>
                    <Text style={styles.deleteShiftButtonText}>🗑️ Delete Shift</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Notes Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Day Plans & Notes</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddNote(!showAddNote)}>
            <Text style={styles.addButtonText}>{showAddNote ? '✕' : '+ Add Note'}</Text>
          </TouchableOpacity>
        </View>

        {/* Add Note Form */}
        {showAddNote && (
          <View style={styles.addNoteForm}>
            <Text style={styles.formLabel}>Note Content *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Swimming at 6pm, Dentist appointment"
              value={noteContent}
              onChangeText={setNoteContent}
              multiline
              maxLength={200}
            />

            <Text style={styles.formLabel}>Time (optional)</Text>
            {Platform.OS === 'web' ? (
              // Web: Use text input with time parsing
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 18:00 or 6:00 PM"
                value={noteTimeText}
                onChangeText={(text) => {
                  const input = (text || '');
                  setNoteTimeText(input);
                  const trimmed = input.trim();
                  if (!trimmed) {
                    setNoteTime(null);
                    return;
                  }

                  // Helper: try to parse a flexible time string
                  const trySetTime = (h: number, m: number) => {
                    if (Number.isNaN(h) || Number.isNaN(m)) return false;
                    if (h < 0 || h > 23 || m < 0 || m > 59) return false;
                    const d = new Date();
                    d.setHours(h, m, 0, 0);
                    setNoteTime(d);
                    return true;
                  };

                  const lower = trimmed.toLowerCase();

                  // 1) AM/PM formats: "6pm", "6 pm", "6:30pm", "6:30 pm", "12am", etc.
                  const ampm = lower.match(/^(\d{1,2})(?::|\.|\s)?(\d{2})?\s*(am|pm)$/i);
                  if (ampm) {
                    const hour = parseInt(ampm[1], 10);
                    const minute = ampm[2] ? parseInt(ampm[2], 10) : 0;
                    const meridiem = ampm[3];
                    if (hour >= 1 && hour <= 12 && minute >= 0 && minute < 60) {
                      let h24 = hour % 12; // 12am -> 0
                      if (meridiem === 'pm') h24 += 12; // add 12 for pm (12pm stays 12)
                      if (trySetTime(h24, minute)) return;
                    }
                  }

                  // 2) 24-hour with separator: "18:00", "6:30", also allow dot or space
                  const sep24 = lower.match(/^(\d{1,2})(?::|\.|\s)(\d{2})$/);
                  if (sep24) {
                    const h = parseInt(sep24[1], 10);
                    const m = parseInt(sep24[2], 10);
                    if (trySetTime(h, m)) return;
                  }

                  // 3) 4-digit military: "1830"
                  const mil = lower.match(/^(\d{4})$/);
                  if (mil) {
                    const h = parseInt(mil[1].slice(0, 2), 10);
                    const m = parseInt(mil[1].slice(2, 4), 10);
                    if (trySetTime(h, m)) return;
                  }

                  // 4) Hour only: "6" or "18" (assume :00)
                  const hourOnly = lower.match(/^(\d{1,2})$/);
                  if (hourOnly) {
                    const h = parseInt(hourOnly[1], 10);
                    if (trySetTime(h, 0)) return;
                  }

                  // If nothing matched, don't update noteTime (allows user to keep typing)
                }}
              />
            ) : (
              // Native: Use DateTimePicker
              <>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.timePickerText}>
                    {noteTime ? format(noteTime, 'h:mm a') : 'Select time...'}
                  </Text>
                </TouchableOpacity>
                {noteTime && (
                  <TouchableOpacity
                    style={styles.clearTimeButton}
                    onPress={() => setNoteTime(null)}>
                    <Text style={styles.clearTimeText}>✕ Clear</Text>
                  </TouchableOpacity>
                )}
                {showTimePicker && (
                  <DateTimePicker
                    value={noteTime || new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        setNoteTime(selectedDate);
                        // Keep web text in sync if user switches platforms (no-op on native web separation)
                        setNoteTimeText(format(selectedDate, 'HH:mm'));
                      }
                    }}
                  />
                )}
              </>
            )}

            <Text style={styles.formLabel}>Category</Text>
            <View style={styles.categoryContainer}>
              {(['appointment', 'event', 'reminder', 'childcare', 'other'] as const).map(
                (cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      noteCategory === cat && styles.categorySelected,
                    ]}
                    onPress={() => setNoteCategory(cat)}>
                    <Text
                      style={[
                        styles.categoryText,
                        noteCategory === cat && styles.categoryTextSelected,
                      ]}>
                      {getCategoryIcon(cat)} {cat}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            <View style={styles.notifyRow}>
              <View style={styles.notifyLabel}>
                <Text style={styles.formLabel}>Notify working members</Text>
                {!currentHouseholdId && (
                  <Text style={styles.notifyDisabledText}>(Household only)</Text>
                )}
              </View>
              <Switch
                value={notifyWorking}
                onValueChange={setNotifyWorking}
                disabled={!currentHouseholdId}
                trackColor={{ false: '#BDC3C7', true: '#6366F1' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddNote(false);
                  setNoteContent('');
                  setNoteTime(null);
                  setShowTimePicker(false);
                }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleAddNote}
                disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Note</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Notes List */}
        {notes.length === 0 && !showAddNote ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No plans or notes for this day</Text>
            <Text style={styles.emptySubtext}>Add a note to keep everyone informed</Text>
          </View>
        ) : (
          notes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteIcon}>{getCategoryIcon(note.category)}</Text>
                <View style={styles.noteInfo}>
                  <Text style={styles.noteContent}>{note.content}</Text>
                  {note.time && <Text style={styles.noteTime}>🕒 {note.time}</Text>}
                </View>
              </View>
              <View style={styles.noteFooter}>
                <Text style={styles.noteAuthor}>
                  by {note.authorName} · {format(
                    note.createdAt && typeof note.createdAt === 'object' && 'seconds' in note.createdAt
                      ? new Date((note.createdAt as any).seconds * 1000)
                      : new Date(note.createdAt),
                    'HH:mm'
                  )}
                </Text>
                <TouchableOpacity onPress={() => handleDeleteNote(note.id)}>
                  <Text style={styles.deleteButton}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F23',
  },
  header: {
    padding: 20,
    backgroundColor: '#0F0F23',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F3F',
  },
  dateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  dateSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#1A1A2E',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  shiftCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  shiftColorBar: {
    width: 4,
  },
  shiftContent: {
    flex: 1,
    padding: 16,
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  shiftIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  shiftInfo: {
    flex: 1,
  },
  shiftTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  shiftOwner: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  shiftTime: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  splitTimesContainer: {
    marginTop: 4,
  },
  splitShiftLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  shiftNotes: {
    fontSize: 14,
    color: '#A1A1AA',
    marginTop: 4,
    fontStyle: 'italic',
  },
  deleteShiftButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  deleteShiftButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  addNoteForm: {
    backgroundColor: '#1A1A2E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#0F0F23',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 16,
  },
  timePickerButton: {
    backgroundColor: '#0F0F23',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  timePickerText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  clearTimeButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  clearTimeText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryOption: {
    backgroundColor: '#0F0F23',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  categorySelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  categoryText: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'capitalize',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  notifyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noteCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  noteIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  noteInfo: {
    flex: 1,
  },
  noteContent: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  noteTime: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteAuthor: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteButton: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  notifyLabel: {
    flexDirection: 'column',
  },
  notifyDisabledText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 2,
  },
});
