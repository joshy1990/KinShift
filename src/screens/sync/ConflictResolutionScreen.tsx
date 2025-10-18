import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {format} from 'date-fns';
import {offlineEditQueueService} from '@/services/offlineEditQueue.service';
import {OfflineEdit} from '@/types';

interface ConflictResolutionScreenProps {
  navigation: any;
}

export const ConflictResolutionScreen: React.FC<ConflictResolutionScreenProps> = ({
  navigation,
}) => {
  const [failedEdits, setFailedEdits] = useState<OfflineEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    loadFailedEdits();
  }, []);

  const loadFailedEdits = async () => {
    try {
      setLoading(true);
      const failed = await offlineEditQueueService.getFailedEdits();
      setFailedEdits(failed);
    } catch (error) {
      console.error('Error loading failed edits:', error);
    } finally {
      setLoading(false);
    }
  };

  const retryEdit = async (editId: string) => {
    try {
      setRetrying(editId);
      await offlineEditQueueService.retryEdit(editId);
      await loadFailedEdits(); // Refresh the list
      Alert.alert('Success', 'Edit has been queued for retry');
    } catch (error) {
      Alert.alert('Error', 'Failed to retry edit');
    } finally {
      setRetrying(null);
    }
  };

  const discardEdit = async (editId: string) => {
    Alert.alert(
      'Discard Edit',
      'Are you sure you want to permanently discard this change? This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from queue by filtering out this edit
              const queue = await offlineEditQueueService.getQueue();
              const filteredQueue = queue.filter(edit => edit.id !== editId);
              await offlineEditQueueService.clearAllEdits();
              
              // Re-add all edits except the discarded one
              for (const edit of filteredQueue) {
                await offlineEditQueueService.addToQueue(
                  edit.operation,
                  edit.collection,
                  edit.documentId,
                  edit.data,
                  edit.userId
                );
              }
              
              await loadFailedEdits();
              Alert.alert('Success', 'Edit has been discarded');
            } catch (error) {
              Alert.alert('Error', 'Failed to discard edit');
            }
          },
        },
      ]
    );
  };

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'create': return '➕';
      case 'update': return '✏️';
      case 'delete': return '🗑️';
      default: return '❓';
    }
  };

  const getCollectionName = (collection: string) => {
    switch (collection) {
      case 'shifts': return 'Shift';
      case 'households': return 'Household';
      case 'users': return 'Profile';
      default: return collection;
    }
  };

  const getOperationDescription = (edit: OfflineEdit) => {
    const collection = getCollectionName(edit.collection);
    const operation = edit.operation.charAt(0).toUpperCase() + edit.operation.slice(1);
    
    if (edit.collection === 'shifts' && edit.data?.title) {
      return `${operation} shift "${edit.data.title}"`;
    }
    
    return `${operation} ${collection.toLowerCase()}`;
  };

  const renderFailedEdit = (edit: OfflineEdit) => (
    <View key={edit.id} style={styles.editCard}>
      <View style={styles.editHeader}>
        <View style={styles.editInfo}>
          <Text style={styles.editIcon}>{getOperationIcon(edit.operation)}</Text>
          <View style={styles.editDetails}>
            <Text style={styles.editTitle}>{getOperationDescription(edit)}</Text>
            <Text style={styles.editSubtitle}>
              Failed after {edit.retryCount} attempts
            </Text>
            <Text style={styles.editTimestamp}>
              {format(edit.timestamp, 'MMM d, h:mm a')}
            </Text>
          </View>
        </View>
        <View style={styles.editBadge}>
          <Text style={styles.editBadgeText}>FAILED</Text>
        </View>
      </View>

      {edit.data && (
        <View style={styles.editData}>
          <Text style={styles.editDataTitle}>Changes:</Text>
          <ScrollView style={styles.editDataScroll} nestedScrollEnabled>
            <Text style={styles.editDataText}>
              {JSON.stringify(edit.data, null, 2)}
            </Text>
          </ScrollView>
        </View>
      )}

      <View style={styles.editActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.retryButton]}
          onPress={() => retryEdit(edit.id)}
          disabled={retrying === edit.id}
        >
          {retrying === edit.id ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.actionButtonText, styles.retryButtonText]}>
              Retry
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.discardButton]}
          onPress={() => discardEdit(edit.id)}
          disabled={retrying === edit.id}
        >
          <Text style={[styles.actionButtonText, styles.discardButtonText]}>
            Discard
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading failed edits...</Text>
      </View>
    );
  }

  if (failedEdits.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>✅</Text>
        <Text style={styles.emptyTitle}>All Clear!</Text>
        <Text style={styles.emptySubtitle}>
          No failed edits need attention. All your changes are synced successfully.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync Conflicts</Text>
        <Text style={styles.subtitle}>
          These changes failed to sync and need your attention. You can retry them or discard them permanently.
        </Text>
      </View>

      <View style={styles.editsList}>
        {failedEdits.map(renderFailedEdit)}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.clearAllButton}
          onPress={() => {
            Alert.alert(
              'Clear All Failed Edits',
              'This will permanently discard all failed changes. Are you sure?',
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Clear All',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      // Clear all failed edits
                      for (const edit of failedEdits) {
                        await offlineEditQueueService.retryEdit(edit.id);
                      }
                      await offlineEditQueueService.clearAllEdits();
                      setFailedEdits([]);
                      Alert.alert('Success', 'All failed edits have been cleared');
                    } catch (error) {
                      Alert.alert('Error', 'Failed to clear all edits');
                    }
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.clearAllButtonText}>Clear All</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    lineHeight: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#7F8C8D',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  backButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editsList: {
    padding: 16,
  },
  editCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE5E5',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
  },
  editInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  editIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  editDetails: {
    flex: 1,
  },
  editTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  editSubtitle: {
    fontSize: 12,
    color: '#E74C3C',
    marginBottom: 4,
  },
  editTimestamp: {
    fontSize: 11,
    color: '#95A5A6',
  },
  editBadge: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  editBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editData: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  editDataTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7F8C8D',
    marginBottom: 8,
  },
  editDataScroll: {
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    padding: 12,
    maxHeight: 120,
  },
  editDataText: {
    fontSize: 11,
    color: '#2C3E50',
    fontFamily: 'monospace',
  },
  editActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#3498DB',
    borderBottomLeftRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
  },
  discardButton: {
    backgroundColor: '#FFFFFF',
    borderBottomRightRadius: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#F0F0F0',
  },
  discardButtonText: {
    color: '#E74C3C',
  },
  footer: {
    padding: 20,
  },
  clearAllButton: {
    backgroundColor: '#E74C3C',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearAllButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});