import {useEffect, useState} from 'react';
import {networkService} from '@/services/network.service';
import {offlineEditQueueService} from '@/services/offlineEditQueue.service';

interface NetworkStatus {
  isConnected: boolean;
  type: string;
  isInternetReachable?: boolean | null;
  connectionDescription: string;
  networkQuality: 'excellent' | 'good' | 'poor' | 'offline';
}

interface OfflineSync {
  pendingCount: number;
  isSyncing: boolean;
}

/**
 * Hook for monitoring network connectivity status
 */
export const useNetworkStatus = (): NetworkStatus => {
  const [status, setStatus] = useState<NetworkStatus>(() => {
    const currentStatus = networkService.getCurrentStatus();
    return {
      isConnected: currentStatus.isConnected,
      type: currentStatus.type,
      isInternetReachable: currentStatus.isInternetReachable,
      connectionDescription: networkService.getConnectionDescription(),
      networkQuality: networkService.getNetworkQuality(),
    };
  });

  useEffect(() => {
    const unsubscribe = networkService.addListener((networkStatus) => {
      setStatus({
        isConnected: networkStatus.isConnected,
        type: networkStatus.type,
        isInternetReachable: networkStatus.isInternetReachable,
        connectionDescription: networkService.getConnectionDescription(),
        networkQuality: networkService.getNetworkQuality(),
      });
    });

    return unsubscribe;
  }, []);

  return status;
};

/**
 * Hook for monitoring offline sync status
 */
export const useOfflineSync = (): OfflineSync & {
  pendingEdits: any[];
  forcSync: () => Promise<void>;
  clearSynced: () => Promise<void>;
} => {
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingEdits, setPendingEdits] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Load initial pending count
    offlineEditQueueService.getPendingCount().then(setPendingCount);
    
    // Load initial queue
    offlineEditQueueService.getQueue().then(queue => {
      setPendingEdits(queue.filter(edit => !edit.synced));
    });

    // Listen for queue changes
    const unsubscribe = offlineEditQueueService.addQueueListener((queueLength) => {
      setPendingCount(queueLength);
      
      // Refresh full queue when count changes
      offlineEditQueueService.getQueue().then(queue => {
        setPendingEdits(queue.filter(edit => !edit.synced));
      });
    });

    return unsubscribe;
  }, []);

  const forceSync = async () => {
    setIsSyncing(true);
    try {
      await offlineEditQueueService.attemptSync();
    } finally {
      setIsSyncing(false);
    }
  };

  const clearSynced = async () => {
    await offlineEditQueueService.clearSyncedEdits();
  };

  return {
    pendingCount,
    pendingEdits,
    isSyncing,
    forceSync,
    /** @deprecated Use forceSync instead */
    forcSync: forceSync,
    clearSynced,
  };
};

/**
 * Combined hook for network and sync status
 */
export const useConnectivity = () => {
  const networkStatus = useNetworkStatus();
  const syncStatus = useOfflineSync();

  return {
    network: networkStatus,
    sync: syncStatus,
    isFullyOnline: networkStatus.isConnected && networkStatus.isInternetReachable !== false,
    canSync: networkStatus.isConnected && syncStatus.pendingCount > 0,
  };
};