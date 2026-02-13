import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/contexts/AuthContext';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ProfileStackParamList} from '@/types';
import {getResponsiveValue, spacing, typography, borderRadius} from '@/utils/responsive';
import {getScreenBottomPadding} from '@/utils/bottomSpacing';
import {showAlert, showConfirm, showError, showSuccess} from '@/utils/alert';
import {getShiftTypeIcon} from '@/utils/shiftColors';
import {shiftService} from '@/services/shift.service';
import {customPatternService} from '@/services/customPattern.service';
import {CustomPattern} from '@/types/customPattern';
import {Modal} from 'react-native';

type ProfileScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

export const ProfileScreen: React.FC = () => {
  const {user, signOut, updateUserProfile} = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [clearingShifts, setClearingShifts] = useState(false);
  const [customPatterns, setCustomPatterns] = useState<any[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<CustomPattern | null>(null);
  const [showPatternModal, setShowPatternModal] = useState(false);

  const handleSignOut = async () => {
    showConfirm(
      'Sign Out',
      'Are you sure you want to sign out?',
      async () => {
        setLoading(true);
        try {
          await signOut();
        } catch (error) {
          console.error('Sign out error:', error);
          showError('Failed to sign out. Please try again.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleChangePassword = () => {
    navigation.navigate('ChangePassword');
  };

  const handleNotificationSettings = () => {
    navigation.navigate('NotificationPreferences');
  };

  const handleSubscription = () => {
    navigation.navigate('Subscription');
  };

  const handleAbout = () => {
    navigation.navigate('About');
  };

  const handleClearAllShifts = async () => {
    showConfirm(
      '⚠️ Clear All Shifts',
      'This will permanently delete ALL your shifts. This cannot be undone. Are you sure?',
      async () => {
        setClearingShifts(true);
        try {
          // Get ALL shifts for this user with pagination
          let allShifts: any[] = [];
          let hasMore = true;
          let lastDoc: any = null;
          
          while (hasMore) {
            const result = await shiftService.getShifts(
              {
                ownerId: user?.id, // Only this user's shifts
              },
              {
                pageSize: 500, // Fetch in batches of 500
                cursor: lastDoc,
              }
            );

            allShifts = allShifts.concat(result.shifts);
            hasMore = result.hasMore;
            lastDoc = result.cursor;
          }

          if (allShifts.length === 0) {
            showAlert('No Shifts', 'You have no shifts to clear.');
            setClearingShifts(false);
            return;
          }

          // Delete all shifts using bulk delete
          const shiftIds = allShifts.map(shift => shift.id);
          
          await shiftService.deleteBulkShifts(shiftIds);
          
          showSuccess(`Deleted ${allShifts.length} shift${allShifts.length !== 1 ? 's' : ''}. Your schedule is now clear.`);
        } catch (error) {
          console.error('Failed to clear shifts:', error);
          showError('Failed to clear shifts. Please try again.');
        } finally {
          setClearingShifts(false);
        }
      }
    );
  };

  const handleViewPattern = (pattern: CustomPattern) => {
    setSelectedPattern(pattern);
    setShowPatternModal(true);
  };

  const handleDeleteCustomPattern = (patternId: string, patternName: string) => {
    showConfirm(
      '⚠️ Delete Custom Shift',
      `Are you sure you want to delete the "${patternName}" pattern? This cannot be undone.`,
      async () => {
        try {
          setClearingShifts(true);
          await customPatternService.deletePattern(patternId);
          // Reload patterns list
          if (user) {
            const patterns = await customPatternService.getUserPatterns(user.id);
            setCustomPatterns(patterns);
          }
          showSuccess(`"${patternName}" pattern deleted successfully`);
        } catch (error) {
          console.error('Failed to delete pattern:', error);
          showError('Failed to delete pattern. Please try again.');
        } finally {
          setClearingShifts(false);
        }
      }
    );
  };

  // Load custom patterns when screen mounts
  React.useEffect(() => {
    const loadPatterns = async () => {
      if (!user) return;
      try {
        const patterns = await customPatternService.getUserPatterns(user.id);
        setCustomPatterns(patterns);
      } catch (error) {
        console.error('Failed to load custom patterns:', error);
      }
    };
    loadPatterns();
  }, [user]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Signing out...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: getScreenBottomPadding(insets.bottom)}
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleEditProfile}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemContent}>
              <Text style={styles.menuIcon}>✏️</Text>
              <Text style={styles.menuText}>Edit Profile</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleChangePassword}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemContent}>
              <Text style={styles.menuIcon}>🔒</Text>
              <Text style={styles.menuText}>Change Password</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleNotificationSettings}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemContent}>
              <Text style={styles.menuIcon}>🔔</Text>
              <Text style={styles.menuText}>Notifications</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleSubscription}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemContent}>
              <Text style={styles.menuIcon}>💎</Text>
              <Text style={styles.menuText}>Subscription</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleAbout}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemContent}>
              <Text style={styles.menuIcon}>ℹ️</Text>
              <Text style={styles.menuText}>About Kinshift</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuIcon}>📱</Text>
              <Text style={styles.menuText}>Version</Text>
            </View>
            <Text style={styles.versionText}>0.1.0</Text>
          </View>
        </View>

        {/* Shift Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shift Management</Text>
          
          <TouchableOpacity 
            style={[styles.menuItem, styles.clearShiftsItem]}
            onPress={handleClearAllShifts}
            activeOpacity={0.7}
            disabled={clearingShifts}
          >
            <View style={styles.menuItemContent}>
              <Text style={styles.menuIcon}>🗑️</Text>
              <View style={styles.clearShiftsContent}>
                <Text style={styles.menuText}>Clear All Shifts</Text>
                <Text style={styles.clearShiftsHint}>Remove all your shifts at once</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Custom Patterns List */}
          {customPatterns.length > 0 && (
            <View style={styles.customPatternsContainer}>
              <Text style={styles.customPatternsTitle}>Your Custom Patterns</Text>
              {customPatterns.map((pattern) => {
                const workingDays = pattern.cells?.filter((c: any) => c.shiftType !== null).length || 0;
                return (
                  <TouchableOpacity 
                    key={pattern.id} 
                    style={styles.patternItem}
                    onPress={() => handleViewPattern(pattern)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.patternItemLeft}>
                      <Text style={styles.patternItemName}>✨ {pattern.name}</Text>
                      <Text style={styles.patternItemDesc}>{workingDays} working days in 14-day cycle</Text>
                      <Text style={styles.patternMode}>
                        {pattern.patternMode === 'weekly' ? '📅 Weekly' : '🔄 Repetition'}
                      </Text>
                    </View>
                    <View style={styles.patternItemRight}>
                      <TouchableOpacity
                        style={styles.patternViewButton}
                        onPress={() => handleViewPattern(pattern)}
                      >
                        <Text style={styles.patternViewButtonText}>View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.patternDeleteButton}
                        onPress={() => handleDeleteCustomPattern(pattern.id, pattern.name)}
                        disabled={clearingShifts}
                      >
                        <Text style={styles.patternDeleteButtonText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
        <TouchableOpacity 
          style={styles.signOutButton} 
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with ❤️ for families</Text>
        </View>
      </ScrollView>

      {/* Pattern Details Modal */}
      <Modal
        visible={showPatternModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPatternModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPatternModal(false)}>
              <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedPattern?.name}</Text>
            <View style={{width: 30}} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Pattern Info */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Pattern Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mode:</Text>
                <Text style={styles.infoValue}>
                  {selectedPattern?.patternMode === 'weekly' ? '📅 Weekly' : '🔄 Repetition'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Working Days:</Text>
                <Text style={styles.infoValue}>
                  {selectedPattern?.cells?.filter((c: any) => c.shiftType !== null).length || 0} / 14
                </Text>
              </View>
            </View>

            {/* Pattern Grid */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Pattern Layout</Text>
              
              {/* Week 1 - Always show */}
              <View style={styles.weekContainer}>
                <Text style={styles.weekLabel}>Week 1</Text>
                <View style={styles.patternGridRow}>
                  {selectedPattern?.cells?.slice(0, 7).map((cell: any, index: number) => {
                    const dayOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    const dayName = dayOfWeek[index];
                    const icon = cell.shiftType ? getShiftTypeIcon(cell.shiftType) : '🚫';
                    
                    return (
                      <View key={index} style={styles.cellPreview}>
                        <Text style={styles.cellDayLabel}>{dayName}</Text>
                        <Text style={styles.cellIcon}>{icon}</Text>
                        {cell.shiftType && (
                          <>
                            <Text style={styles.cellTime}>{cell.startTime}</Text>
                            <Text style={styles.cellTime}>{cell.endTime}</Text>
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Week 2 - Only show for Repetition mode */}
              {selectedPattern?.patternMode === 'repetition' && (
                <View style={styles.weekContainer}>
                  <Text style={styles.weekLabel}>Week 2</Text>
                  <View style={styles.patternGridRow}>
                    {selectedPattern?.cells?.slice(7, 14).map((cell: any, index: number) => {
                      const dayOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                      const dayName = dayOfWeek[index];
                      const icon = cell.shiftType ? getShiftTypeIcon(cell.shiftType) : '🚫';
                      
                      return (
                        <View key={index + 7} style={styles.cellPreview}>
                          <Text style={styles.cellDayLabel}>{dayName}</Text>
                          <Text style={styles.cellIcon}>{icon}</Text>
                          {cell.shiftType && (
                            <>
                              <Text style={styles.cellTime}>{cell.startTime}</Text>
                              <Text style={styles.cellTime}>{cell.endTime}</Text>
                            </>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Info for Weekly mode */}
              {selectedPattern?.patternMode === 'weekly' && (
                <View style={styles.patternModeNote}>
                  <Text style={styles.patternModeNoteText}>
                    📅 This weekly pattern repeats every 7 days
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body,
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  avatarContainer: {
    width: getResponsiveValue(80, 100, 120),
    height: getResponsiveValue(80, 100, 120),
    borderRadius: getResponsiveValue(40, 50, 60),
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: getResponsiveValue(32, 40, 48),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  name: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  email: {
    fontSize: typography.body,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.caption,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F1F37',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    fontSize: getResponsiveValue(20, 22, 24),
    marginRight: spacing.md,
  },
  menuText: {
    fontSize: typography.body,
    color: '#FFFFFF',
    flex: 1,
  },
  menuArrow: {
    fontSize: getResponsiveValue(24, 28, 32),
    color: '#6B7280',
    fontWeight: '300',
  },
  versionText: {
    fontSize: typography.body,
    color: '#6B7280',
  },
  clearShiftsItem: {
    backgroundColor: '#2D2D3D',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  clearShiftsContent: {
    flex: 1,
  },
  clearShiftsHint: {
    fontSize: typography.caption,
    color: '#9CA3AF',
    marginTop: spacing.xs,
  },
  customPatternsContainer: {
    marginTop: spacing.lg,
    backgroundColor: '#1F1F37',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  customPatternsTitle: {
    fontSize: typography.caption,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  patternItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F0F23',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  patternItemLeft: {
    flex: 1,
  },
  patternItemName: {
    fontSize: typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  patternItemDesc: {
    fontSize: typography.caption,
    color: '#9CA3AF',
  },
  patternMode: {
    fontSize: typography.caption,
    color: '#6366F1',
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  patternItemRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  patternViewButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  patternViewButtonText: {
    fontSize: typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  patternDeleteButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  patternDeleteButtonText: {
    fontSize: typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  signOutButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: '#DC2626',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  signOutText: {
    fontSize: typography.bodyLarge,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
  },
  footerText: {
    fontSize: typography.caption,
    color: '#6B7280',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F37',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
    width: 30,
    textAlign: 'center',
  },
  modalTitle: {
    fontSize: typography.title,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    padding: spacing.md,
  },
  modalSection: {
    marginBottom: spacing.lg,
    backgroundColor: '#1F1F37',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  modalSectionTitle: {
    fontSize: typography.subtitle,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D3D',
    paddingBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#0F0F23',
  },
  infoLabel: {
    fontSize: typography.body,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  patternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weekContainer: {
    marginBottom: spacing.md,
  },
  weekLabel: {
    fontSize: typography.body,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  patternGridRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  cellPreview: {
    width: '12.5%',
    backgroundColor: '#0F0F23',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D3D',
  },
  cellDayLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  cellIcon: {
    fontSize: 20,
    marginVertical: spacing.xs,
  },
  cellTime: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: spacing.xs,
    lineHeight: 12,
  },
  patternModeNote: {
    backgroundColor: '#1F2937',
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  patternModeNoteText: {
    fontSize: typography.body,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});
