import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  SafeAreaView,
} from 'react-native';
import {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import {Notification, MainTabsParamList} from '@/types';
import {useAuth} from '@/contexts/AuthContext';
import {useCurrentHouseholdId} from '@/contexts/HouseholdContext';
import {getResponsiveValue, spacing, typography, borderRadius, isTablet} from '@/utils/responsive';
import {format, isToday, isYesterday, formatDistanceToNow} from 'date-fns';
import {notificationService} from '../../services/notification.service';
import {showAlert, showError, showConfirm} from '@/utils/alert';

type Props = BottomTabScreenProps<MainTabsParamList, 'Notifications'>;

export const NotificationsScreen: React.FC<Props> = ({navigation}) => {
  const {user} = useAuth();
  const currentHouseholdId = useCurrentHouseholdId();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load real Firebase notifications
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Load initial notifications
    const loadNotifications = async () => {
      try {
        const realNotifications = await notificationService.getUserNotifications(user.id);
        setNotifications(realNotifications);
      } catch (error) {
        console.error('Error loading notifications:', error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();

    // Set up real-time listener for live updates
    const unsubscribe = notificationService.listenToUserNotifications(
      user.id,
      (liveNotifications) => {
        setNotifications(liveNotifications);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  // Memoize refresh handler
  const handleRefresh = useCallback(async () => {
    if (!user) return;
    
    setRefreshing(true);
    try {
      const freshNotifications = await notificationService.getUserNotifications(user.id);
      setNotifications(freshNotifications);
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  // Memoize mark as read handler
  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    // Optimistic update
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? {...n, read: true} : n)
    );
    
    // Sync to Firebase
    try {
      await notificationService.markAsRead(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Revert on error
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? {...n, read: false} : n)
      );
    }
  }, []);

  // Memoize mark all as read handler
  const handleMarkAllAsRead = useCallback(async () => {
    if (!user) return;
    
    // Optimistic update
    const previousNotifications = notifications;
    setNotifications(prev => prev.map(n => ({...n, read: true})));
    
    // Sync to Firebase
    try {
      await notificationService.markAllAsRead(user.id);
    } catch (error) {
      console.error('Error marking all as read:', error);
      // Revert on error
      setNotifications(previousNotifications);
    }
  }, [user, notifications]);

  // Memoize delete handler
  const handleDeleteNotification = useCallback((notificationId: string) => {
    showConfirm(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      async () => {
        // Optimistic delete
        const previousNotifications = notifications;
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        
        // Sync to Firebase
        try {
          await notificationService.deleteNotification(notificationId);
        } catch (error) {
          console.error('Error deleting notification:', error);
          // Revert on error
          setNotifications(previousNotifications);
          showError('Failed to delete notification. Please try again.');
        }
      }
    );
  }, [notifications]);

  // Memoize notification tap handler
  const handleNotificationTap = useCallback((notification: Notification) => {
    // Mark as read if not already
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }

    // Handle navigation based on notification type
    const {data} = notification;
    
    switch (notification.type) {
      case 'shift_created':
      case 'shift_updated':
      case 'shift_edited':
      case 'shift_deleted':
      case 'shift_reminder':
        // Navigate to shift detail if we have a shiftId
        if (data?.shiftId) {
          navigation.navigate('Calendar' as any, {
            screen: 'ShiftDetail',
            params: {shiftId: data.shiftId},
          });
        } else {
          // Fallback to calendar view
          navigation.navigate('Calendar' as any);
        }
        break;
        
      case 'message':
      case 'day_message':
        // Navigate to calendar, optionally with a specific date
        if (data?.date) {
          navigation.navigate('Calendar' as any, {
            screen: 'CalendarView',
            params: {initialDate: data.date},
          });
        } else {
          navigation.navigate('Calendar' as any);
        }
        break;

      case 'day_note_added':
        // Navigate to calendar day detail with the specific date
        if (data?.date) {
          navigation.navigate('Calendar' as any, {
            screen: 'DayDetail',
            params: {date: data.date},
          });
        } else {
          // Fallback to calendar view
          navigation.navigate('Calendar' as any);
        }
        break;
        
      case 'invite':
      case 'invitation_received':
        // Navigate to household screen
        if (data?.householdId) {
          navigation.navigate('Household' as any, {
            screen: 'HouseholdDetail',
            params: {householdId: data.householdId},
          });
        } else if (data?.inviteCode) {
          navigation.navigate('Household' as any, {
            screen: 'InvitationAccept',
            params: {inviteCode: data.inviteCode},
          });
        } else {
          navigation.navigate('Household' as any);
        }
        break;
        
      case 'conflict':
      case 'conflict_detected':
        // Navigate to calendar to view conflicting shifts
        if (data?.shiftId) {
          navigation.navigate('Calendar' as any, {
            screen: 'ShiftDetail',
            params: {shiftId: data.shiftId},
          });
        } else {
          navigation.navigate('Calendar' as any);
        }
        break;
        
      default:
        // Unknown type, just go to main calendar
        navigation.navigate('Calendar' as any);
        break;
    }
  }, [navigation, handleMarkAsRead]);

  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'shift_created':
        return '📅';
      case 'shift_updated':
      case 'shift_edited':
        return '✏️';
      case 'shift_deleted':
        return '🗑️';
      case 'shift_reminder':
        return '⏰';
      case 'conflict':
      case 'conflict_detected':
        return '⚠️';
      case 'invite':
      case 'invitation_received':
        return '👥';
      case 'message':
      case 'day_message':
        return '💬';
      case 'day_note_added':
        return '📝';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type: string): string => {
    switch (type) {
      case 'shift_created':
        return '#6366F1'; // Indigo
      case 'shift_updated':
      case 'shift_edited':
        return '#3B82F6'; // Blue
      case 'shift_deleted':
        return '#EF4444'; // Red
      case 'shift_reminder':
        return '#F59E0B'; // Amber
      case 'conflict':
      case 'conflict_detected':
        return '#EF4444'; // Red
      case 'invite':
      case 'invitation_received':
        return '#10B981'; // Green
      case 'message':
      case 'day_message':
        return '#8B5CF6'; // Purple
      case 'day_note_added':
        return '#06B6D4'; // Cyan
      default:
        return '#6B7280'; // Gray
    }
  };

  const getRelativeTime = (date: Date): string => {
    return formatDistanceToNow(date, {addSuffix: true});
  };

  const groupNotificationsByDate = (notifications: Notification[]) => {
    const groups: {[key: string]: Notification[]} = {};
    
    notifications.forEach(notification => {
      let groupKey = '';
      
      if (isToday(notification.createdAt)) {
        groupKey = 'Today';
      } else if (isYesterday(notification.createdAt)) {
        groupKey = 'Yesterday';
      } else {
        groupKey = format(notification.createdAt, 'MMMM d, yyyy');
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(notification);
    });
    
    return groups;
  };

  const renderNotification = (notification: Notification) => (
    <View key={notification.id} style={styles.notificationWrapper}>
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !notification.read && styles.unreadCard,
        ]}
        onPress={() => handleNotificationTap(notification)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <View 
              style={[
                styles.iconContainer,
                { backgroundColor: getNotificationColor(notification.type) }
              ]}
            >
              <Text style={styles.notificationIcon}>
                {getNotificationIcon(notification.type)}
              </Text>
            </View>
            
            <View style={styles.notificationMeta}>
              <View style={styles.titleRow}>
                <Text style={[
                  styles.notificationTitle,
                  !notification.read && styles.unreadTitle
                ]}>
                  {notification.title}
                </Text>
                {!notification.read && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notificationTime}>
                {getRelativeTime(notification.createdAt)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteNotification(notification.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteIcon}>×</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={[
            styles.notificationBody,
            !notification.read && styles.unreadBody
          ]}>
            {notification.body}
          </Text>

          {notification.data?.priority === 'high' && (
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityText}>High Priority</Text>
            </View>
          )}
        </View>

        {!notification.read && <View style={styles.unreadIndicator} />}
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Text style={styles.emptyIcon}>🔔</Text>
      </View>
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyDescription}>
        You're all caught up! Notifications about shifts, invitations, and updates will appear here.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const groupedNotifications = groupNotificationsByDate(notifications);
  const hasUnread = notifications.some(n => !n.read);

  return (
    <SafeAreaView style={styles.container}>
      {hasUnread && (
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          renderEmptyState()
        ) : (
          Object.entries(groupedNotifications).map(([date, dateNotifications]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{date}</Text>
              {dateNotifications.map(renderNotification)}
            </View>
          ))
        )}
      </ScrollView>
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
    backgroundColor: '#0F0F23',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body,
    color: '#9CA3AF',
  },
  header: {
    backgroundColor: '#1F1F37',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  markAllButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#6366F1',
  },
  markAllText: {
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  dateGroup: {
    marginBottom: spacing.lg,
  },
  dateHeader: {
    fontSize: typography.body,
    fontWeight: '700',
    color: '#F3F4F6',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
  notificationWrapper: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  notificationCard: {
    backgroundColor: '#1F1F37',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  unreadCard: {
    borderColor: '#6366F1',
    borderWidth: 1.5,
  },
  unreadIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#6366F1',
  },
  notificationContent: {
    padding: spacing.lg,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: getResponsiveValue(40, 44, 48),
    height: getResponsiveValue(40, 44, 48),
    borderRadius: getResponsiveValue(20, 22, 24),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  notificationIcon: {
    fontSize: getResponsiveValue(18, 20, 22),
    color: '#FFFFFF',
  },
  notificationMeta: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  notificationTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#D1D5DB',
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadTitle: {
    color: '#F3F4F6',
    fontWeight: '700',
  },
  notificationTime: {
    fontSize: typography.caption,
    color: '#9CA3AF',
    marginTop: 2,
  },
  deleteButton: {
    width: getResponsiveValue(28, 32, 36),
    height: getResponsiveValue(28, 32, 36),
    borderRadius: getResponsiveValue(14, 16, 18),
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  deleteIcon: {
    fontSize: getResponsiveValue(18, 20, 22),
    color: '#9CA3AF',
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
    marginLeft: spacing.sm,
  },
  notificationBody: {
    fontSize: typography.caption,
    color: '#9CA3AF',
    lineHeight: typography.caption * 1.5,
    marginBottom: spacing.sm,
  },
  unreadBody: {
    color: '#D1D5DB',
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EF4444',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  priorityText: {
    fontSize: getResponsiveValue(9, 10, 11),
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl * 2,
    paddingTop: spacing.xl * 3,
  },
  emptyIconContainer: {
    width: getResponsiveValue(72, 80, 88),
    height: getResponsiveValue(72, 80, 88),
    borderRadius: getResponsiveValue(36, 40, 44),
    backgroundColor: '#1F1F37',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#374151',
  },
  emptyIcon: {
    fontSize: getResponsiveValue(28, 32, 36),
  },
  emptyTitle: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#F3F4F6',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: typography.caption,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: typography.caption * 1.5,
    maxWidth: getResponsiveValue(280, 320, 400),
  },
});
