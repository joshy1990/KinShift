import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {OfflineEdit} from '@/types';
import {shiftService} from './shift.service';
import {householdService} from './household.service';

interface SyncResult {
  success: boolean;
  error?: string;
  conflicted?: boolean;
}

class OfflineEditQueueService {
  private readonly QUEUE_KEY = '@linkshift:offline_edit_queue';
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second
  
  private syncInProgress = false;
  private listeners: Array<(queueLength: number) => void> = [];

  /**
   * Add a listener for queue length changes
   */
  addQueueListener(callback: (queueLength: number) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Notify listeners of queue length changes
   */
  private notifyListeners(queueLength: number) {
    this.listeners.forEach(listener => listener(queueLength));
  }

  /**
   * Add an operation to the offline queue
   */
  async addToQueue(
    operation: 'create' | 'update' | 'delete',
    collection: 'shifts' | 'households' | 'users',
    documentId: string,
    data: any,
    userId?: string
  ): Promise<void> {
    try {
      const offlineEdit: OfflineEdit = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        operation,
        collection,
        documentId,
        data,
        userId,
        timestamp: new Date(),
        synced: false,
        retryCount: 0,
      };

      const queue = await this.getQueue();
      queue.push(offlineEdit);
      await this.saveQueue(queue);
      
      this.notifyListeners(queue.length);

      // Try to sync immediately if online
      this.attemptSync();

    } catch (error) {
      console.error('Error adding to offline queue:', error);
      throw error;
    }
  }

  /**
   * Get the current offline edit queue
   */
  async getQueue(): Promise<OfflineEdit[]> {
    try {
      const queueJson = await AsyncStorage.getItem(this.QUEUE_KEY);
      if (!queueJson) return [];

      const queue = JSON.parse(queueJson);
      
      // Convert timestamp strings back to Date objects
      return queue.map((edit: any) => ({
        ...edit,
        timestamp: new Date(edit.timestamp),
      }));
    } catch (error) {
      console.error('Error getting offline queue:', error);
      return [];
    }
  }

  /**
   * Save the offline edit queue to storage
   */
  private async saveQueue(queue: OfflineEdit[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
      throw error;
    }
  }

  /**
   * Get the number of pending operations
   */
  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter(edit => !edit.synced).length;
  }

  /**
   * Attempt to sync all pending operations
   */
  async attemptSync(): Promise<void> {
    if (this.syncInProgress) return;

    try {
      this.syncInProgress = true;
      const netInfo = await NetInfo.fetch();
      
      if (!netInfo.isConnected) {
        console.log('Device is offline, skipping sync');
        return;
      }

      const queue = await this.getQueue();
      const pendingEdits = queue.filter(edit => !edit.synced);

      if (pendingEdits.length === 0) {
        console.log('No pending edits to sync');
        return;
      }

      console.log(`Syncing ${pendingEdits.length} offline edits...`);

      let hasChanges = false;
      
      for (const edit of pendingEdits) {
        try {
          const result = await this.syncSingleEdit(edit);
          
          if (result.success) {
            edit.synced = true;
            hasChanges = true;
            console.log(`Successfully synced ${edit.operation} on ${edit.collection}/${edit.documentId}`);
          } else {
            edit.retryCount++;
            hasChanges = true;
            
            if (edit.retryCount >= this.MAX_RETRIES) {
              console.error(`Failed to sync edit after ${this.MAX_RETRIES} attempts:`, result.error);
              // Keep in queue but mark as failed - could implement dead letter queue
            }
          }
        } catch (error) {
          console.error(`Error syncing edit ${edit.id}:`, error);
          edit.retryCount++;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await this.saveQueue(queue);
        const remainingCount = queue.filter(edit => !edit.synced).length;
        this.notifyListeners(remainingCount);
      }

    } catch (error) {
      console.error('Error during sync attempt:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync a single offline edit
   */
  private async syncSingleEdit(edit: OfflineEdit): Promise<SyncResult> {
    try {
      switch (edit.collection) {
        case 'shifts':
          return await this.syncShiftEdit(edit);
        case 'households':
          return await this.syncHouseholdEdit(edit);
        case 'users':
          return await this.syncUserEdit(edit);
        default:
          return {success: false, error: `Unknown collection: ${edit.collection}`};
      }
    } catch (error: any) {
      return {success: false, error: error.message || 'Unknown sync error'};
    }
  }

  /**
   * Sync a shift-related edit
   */
  private async syncShiftEdit(edit: OfflineEdit): Promise<SyncResult> {
    try {
      switch (edit.operation) {
        case 'create':
          await shiftService.createShift(edit.data);
          return {success: true};
          
        case 'update':
          if (!edit.userId) {
            return {success: false, error: 'UserId required for shift updates'};
          }
          await shiftService.updateShift(edit.documentId, edit.data, edit.userId);
          return {success: true};
          
        case 'delete':
          if (!edit.userId) {
            return {success: false, error: 'UserId required for shift deletion'};
          }
          await shiftService.deleteShift(edit.documentId, edit.userId);
          return {success: true};
          
        default:
          return {success: false, error: `Unknown operation: ${edit.operation}`};
      }
    } catch (error: any) {
      // Check if it's a conflict (document doesn't exist, version mismatch, etc.)
      if (error.message?.includes('not found') || error.message?.includes('conflict')) {
        return {success: false, error: error.message, conflicted: true};
      }
      
      return {success: false, error: error.message || 'Shift sync error'};
    }
  }

  /**
   * Sync a household-related edit
   */
  private async syncHouseholdEdit(edit: OfflineEdit): Promise<SyncResult> {
    try {
      switch (edit.operation) {
        case 'create':
          await householdService.createHousehold(
            edit.data.name, 
            edit.data.creatorId, 
            edit.data.settings
          );
          return {success: true};
          
        case 'update':
          // Household service doesn't have a generic update method
          // This would need to be implemented based on what's being updated
          return {success: false, error: 'Household updates not yet implemented in sync'};
          
        case 'delete':
          // Households are typically not deleted, just left
          return {success: false, error: 'Household deletion not supported'};
          
        default:
          return {success: false, error: `Unknown operation: ${edit.operation}`};
      }
    } catch (error: any) {
      return {success: false, error: error.message || 'Household sync error'};
    }
  }

  /**
   * Sync a user-related edit
   */
  private async syncUserEdit(edit: OfflineEdit): Promise<SyncResult> {
    try {
      // User edits would typically be profile updates
      // This would integrate with auth service when profile management is implemented
      return {success: false, error: 'User sync not yet implemented'};
    } catch (error: any) {
      return {success: false, error: error.message || 'User sync error'};
    }
  }

  /**
   * Clear all synced edits from the queue
   */
  async clearSyncedEdits(): Promise<void> {
    try {
      const queue = await this.getQueue();
      const unsyncedEdits = queue.filter(edit => !edit.synced);
      await this.saveQueue(unsyncedEdits);
      this.notifyListeners(unsyncedEdits.length);
    } catch (error) {
      console.error('Error clearing synced edits:', error);
    }
  }

  /**
   * Clear the entire queue (use with caution)
   */
  async clearAllEdits(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.QUEUE_KEY);
      this.notifyListeners(0);
    } catch (error) {
      console.error('Error clearing all edits:', error);
    }
  }

  /**
   * Get failed edits that exceeded retry limit
   */
  async getFailedEdits(): Promise<OfflineEdit[]> {
    const queue = await this.getQueue();
    return queue.filter(edit => !edit.synced && edit.retryCount >= this.MAX_RETRIES);
  }

  /**
   * Retry a failed edit (reset retry count)
   */
  async retryEdit(editId: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const edit = queue.find(e => e.id === editId);
      
      if (edit) {
        edit.retryCount = 0;
        await this.saveQueue(queue);
        this.attemptSync();
      }
    } catch (error) {
      console.error('Error retrying edit:', error);
    }
  }

  /**
   * Initialize the service - set up network listener
   */
  initialize(): () => void {
    // Listen for network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && !this.syncInProgress) {
        // Connection restored, attempt sync
        setTimeout(() => this.attemptSync(), 1000); // Small delay to ensure stable connection
      }
    });

    // Initial sync attempt
    this.attemptSync();

    return unsubscribe;
  }

  /**
   * Create an optimistic edit (apply locally, queue for sync)
   */
  async createOptimisticEdit<T>(
    operation: 'create' | 'update' | 'delete',
    collection: 'shifts' | 'households' | 'users',
    documentId: string,
    data: T,
    userId?: string,
    optimisticUpdate?: () => Promise<void>
  ): Promise<void> {
    try {
      // Apply optimistic update first
      if (optimisticUpdate) {
        await optimisticUpdate();
      }

      // Add to offline queue
      await this.addToQueue(operation, collection, documentId, data, userId);

    } catch (error) {
      console.error('Error creating optimistic edit:', error);
      throw error;
    }
  }
}

export const offlineEditQueueService = new OfflineEditQueueService();