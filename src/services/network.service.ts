import NetInfo, {NetInfoState, NetInfoStateType} from '@react-native-community/netinfo';
import {offlineEditQueueService} from './offlineEditQueue.service';

interface NetworkStatus {
  isConnected: boolean;
  type: NetInfoStateType;
  isInternetReachable?: boolean | null;
  details?: any;
}

type NetworkListener = (status: NetworkStatus) => void;

class NetworkService {
  private currentStatus: NetworkStatus = {
    isConnected: false,
    type: NetInfoStateType.unknown,
  };
  
  private listeners: NetworkListener[] = [];
  private unsubscribe: (() => void) | null = null;
  private syncTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initialize network monitoring
   */
  initialize(): () => void {
    // Get initial network state
    NetInfo.fetch().then(this.handleNetworkChange);

    // Subscribe to network state changes
    this.unsubscribe = NetInfo.addEventListener(this.handleNetworkChange);

    return this.cleanup;
  }

  /**
   * Clean up network monitoring
   */
  cleanup = (): void => {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    if (this.syncTimeoutId) {
      clearTimeout(this.syncTimeoutId);
      this.syncTimeoutId = null;
    }
  };

  /**
   * Handle network state changes
   */
  private handleNetworkChange = (state: NetInfoState): void => {
    const previousStatus = this.currentStatus;
    
    this.currentStatus = {
      isConnected: state.isConnected ?? false,
      type: state.type,
      isInternetReachable: state.isInternetReachable,
      details: state.details,
    };

    // Notify listeners
    this.listeners.forEach(listener => listener(this.currentStatus));

    // If we went from offline to online, trigger sync after a short delay
    if (!previousStatus.isConnected && this.currentStatus.isConnected) {
      this.onConnectionRestored();
    }
  };

  /**
   * Handle connection restoration
   */
  private onConnectionRestored(): void {
    // Clear any existing timeout
    if (this.syncTimeoutId) {
      clearTimeout(this.syncTimeoutId);
    }

    // Wait a bit for connection to stabilize, then sync
    this.syncTimeoutId = setTimeout(() => {
      offlineEditQueueService.attemptSync();
    }, 2000); // 2 second delay
  }

  /**
   * Get current network status
   */
  getCurrentStatus(): NetworkStatus {
    return this.currentStatus;
  }

  /**
   * Check if device is currently online
   */
  isOnline(): boolean {
    return this.currentStatus.isConnected;
  }

  /**
   * Check if device has internet access (not just connected to WiFi)
   */
  hasInternetAccess(): boolean {
    return this.currentStatus.isConnected && 
           this.currentStatus.isInternetReachable !== false;
  }

  /**
   * Get connection type
   */
  getConnectionType(): NetInfoStateType {
    return this.currentStatus.type;
  }

  /**
   * Check if on WiFi
   */
  isOnWiFi(): boolean {
    return this.currentStatus.type === NetInfoStateType.wifi;
  }

  /**
   * Check if on cellular
   */
  isOnCellular(): boolean {
    return this.currentStatus.type === NetInfoStateType.cellular;
  }

  /**
   * Add network status listener
   */
  addListener(callback: NetworkListener): () => void {
    this.listeners.push(callback);
    
    // Immediately call with current status
    callback(this.currentStatus);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Force a sync attempt (only if online)
   */
  async forceSyncIfOnline(): Promise<void> {
    if (this.isOnline()) {
      await offlineEditQueueService.attemptSync();
    }
  }

  /**
   * Refresh network state
   */
  async refresh(): Promise<NetworkStatus> {
    const state = await NetInfo.fetch();
    this.handleNetworkChange(state);
    return this.currentStatus;
  }

  /**
   * Get human-readable connection description
   */
  getConnectionDescription(): string {
    if (!this.currentStatus.isConnected) {
      return 'Offline';
    }

    switch (this.currentStatus.type) {
      case NetInfoStateType.wifi:
        return 'WiFi';
      case NetInfoStateType.cellular:
        return 'Cellular';
      case NetInfoStateType.ethernet:
        return 'Ethernet';
      case NetInfoStateType.bluetooth:
        return 'Bluetooth';
      case NetInfoStateType.wimax:
        return 'WiMAX';
      case NetInfoStateType.vpn:
        return 'VPN';
      case NetInfoStateType.other:
        return 'Other';
      case NetInfoStateType.unknown:
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if connection is suitable for large operations
   */
  isSuitableForLargeOperations(): boolean {
    if (!this.isOnline()) return false;
    
    // Prefer WiFi for large operations, but allow cellular
    return this.currentStatus.type === NetInfoStateType.wifi || 
           this.currentStatus.type === NetInfoStateType.ethernet;
  }

  /**
   * Get network quality indicator
   */
  getNetworkQuality(): 'excellent' | 'good' | 'poor' | 'offline' {
    if (!this.currentStatus.isConnected) {
      return 'offline';
    }

    // This is a simple heuristic - could be enhanced with ping tests
    switch (this.currentStatus.type) {
      case NetInfoStateType.wifi:
      case NetInfoStateType.ethernet:
        return 'excellent';
      case NetInfoStateType.cellular:
        // Could check cellular generation (4G, 5G) from details
        return 'good';
      default:
        return 'poor';
    }
  }

  /**
   * Wait for online connection
   */
  async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    if (this.isOnline()) {
      return true;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeoutMs);

      const unsubscribe = this.addListener((status) => {
        if (status.isConnected) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }
}

export const networkService = new NetworkService();