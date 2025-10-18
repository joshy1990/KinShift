import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarStackParamList, Shift, DayNote } from '@/types';
import { format, isSameDay } from 'date-fns';
import { shiftService } from '@/services/shift.service';
import { dayNoteService } from '@/services/dayNote.service';
import { householdService } from '@/services/household.service';
import { getShiftTypeIcon, SHIFT_TYPE_COLORS } from '@/utils/shiftColors';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentHouseholdId } from '@/contexts/HouseholdContext';
import { showAlert, showError, showSuccess, showConfirm } from '@/utils/alert';

type Props = NativeStackScreenProps<CalendarStackParamList, 'DayDetail'>;

export const DayDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { date, shifts: passedShifts } = route.params;
  const { user } = useAuth();
  const currentHouseholdId = useCurrentHouseholdId();
  const [shifts, setShifts] = useState<Shift[]>(passedShifts || []);
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [users, setUsers] = useState<Record<string, { name: string; email: string }>>({});
  const [loading, setLoading] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteTime, setNoteTime] = useState('');
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
            startDate: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0),
            endDate: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59),
          },
          (updatedShifts) => {
            console.log('📅 Day details: Personal shifts updated:', updatedShifts.length);
            setShifts(updatedShifts);
          }
        );
      } else if (currentHouseholdId) {
        // Household mode - subscribe to shifts for this household on this day
        unsubscribeShifts = shiftService.subscribeToShifts(
          {
            householdId: currentHouseholdId,
            startDate: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0),
            endDate: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59),
          },
          (updatedShifts) => {
            console.log('📅 Day details: Household shifts updated:', updatedShifts.length);
            // Filter out shifts from users no longer in household
            const filteredShifts = updatedShifts.filter(shift => {
              const isUserInHousehold = !!users[shift.ownerId];
              if (!isUserInHousehold) {
                console.log('📅 Day details: Filtering out shift from departed user:', shift.ownerId);
              }
              return isUserInHousehold;
            });
            console.log('📅 Day details: After filtering:', filteredShifts.length);
            setShifts(filteredShifts);
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
      console.log('Real-time updates not available, will use polling');
    }

    return () => {
      if (unsubscribeShifts) unsubscribeShifts();
      if (unsubscribeNotes) unsubscribeNotes();
    };
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
        setUsers({
          [user.id]: { name: user.name || 'You', email: user.email || '' }
        });
      } else {
        // Household mode - fetch real household members
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
      }
      
      // Load shifts for this day
      let dayShifts: Shift[] = [];
      if (passedShifts && passedShifts.length > 0) {
        // Use passed shifts if available (quick initial load)
        dayShifts = passedShifts;
        console.log('📊 Using passed shifts:', dayShifts.length, 'shifts');
      } else if (isPersonalMode) {
        // Fallback to loading from DB if no passed shifts
        const result = await shiftService.getShifts({ 
          ownerId: user.id, 
          startDate: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0),
          endDate: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59)
        });
        console.log('📊 getShifts returned:', result.shifts.length, 'shifts');
        dayShifts = result.shifts;
      } else {
        dayShifts = await shiftService.getHouseholdShifts(
          currentHouseholdId!, 
          new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0),
          new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59)
        );
      }
      
      // Get notes - personal mode or household mode
      const dayNotes = isPersonalMode
        ? await dayNoteService.getNotesByDate(user.id, dateObj, true) // Personal notes
        : await dayNoteService.getNotesByDate(currentHouseholdId!, dateObj, false); // Household notes

      console.log('Loaded day data:', { 
        date: dateString, 
        shifts: dayShifts.length, 
        notes: dayNotes.length, 
        personalMode: isPersonalMode,
        usedPassedShifts: !!passedShifts && passedShifts.length > 0
      });
      setShifts(dayShifts);
      setNotes(dayNotes);
    } catch (error) {
      console.error('Failed to load day data:', error);
      showError('Failed to load day information');
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
    try {
      await dayNoteService.createNote({
        householdId: currentHouseholdId || undefined, // undefined for personal notes
        date: dateString,
        authorId: user.id,
        authorName: user.name || 'User',
        content: noteContent.trim(),
        time: noteTime.trim() || undefined,
        category: noteCategory,
        notifyWorkingMembers: isPersonalMode ? false : notifyWorking, // No notifications in personal mode
      });

      // Reset form
      setNoteContent('');
      setNoteTime('');
      setNoteCategory('other');
      setNotifyWorking(true);
      setShowAddNote(false);

      // Reload data to show new note
      await loadDayData();

      showSuccess('Note added successfully!' + (notifyWorking ? '\n\nWorking members have been notified.' : ''));
    } catch (error) {
      console.error('Failed to add note:', error);
      showError('Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    showConfirm(
      'Delete Note',
      'Are you sure you want to delete this note?',
      async () => {
        try {
          await dayNoteService.deleteNote(noteId);
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
                  { backgroundColor: SHIFT_TYPE_COLORS[shift.shiftType] },
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
                {shift.notes && <Text style={styles.shiftNotes}>📝 {shift.notes}</Text>}
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
            <TextInput
              style={styles.textInput}
              placeholder="e.g., 18:00"
              value={noteTime}
              onChangeText={setNoteTime}
              maxLength={5}
            />

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
                  setNoteTime('');
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
                  by {note.authorName} · {format(new Date(note.createdAt), 'HH:mm')}
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
  );
};

const styles = StyleSheet.create({
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
    color: '#6B7280',
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
  shiftNotes: {
    fontSize: 14,
    color: '#A1A1AA',
    marginTop: 4,
    fontStyle: 'italic',
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    color: '#6B7280',
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
