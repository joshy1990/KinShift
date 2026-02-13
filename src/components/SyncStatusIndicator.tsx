import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ActivityIndicator} from 'react-native';
import {useConnectivity} from '@/hooks/useConnectivity';

interface SyncStatusIndicatorProps {
  style?: any;
  showDetails?: boolean;
  onPress?: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  style,
  showDetails = false,
  onPress,
}) => {
  const {network, sync, canSync} = useConnectivity();

  const getStatusColor = () => {
    if (!network.isConnected) return '#E74C3C'; // Red for offline
    if (sync.pendingCount > 0) return '#F39C12'; // Orange for pending
    if (sync.isSyncing) return '#3498DB'; // Blue for syncing
    return '#27AE60'; // Green for online and synced
  };

  const getStatusText = () => {
    if (!network.isConnected) return 'Offline';
    if (sync.isSyncing) return 'Syncing...';
    if (sync.pendingCount > 0) return `${sync.pendingCount} pending`;
    return 'Online';
  };

  const getStatusIcon = () => {
    if (sync.isSyncing) return '↻';
    if (!network.isConnected) return '⚠';
    if (sync.pendingCount > 0) return '⏸';
    return '✓';
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (canSync) {
      sync.forcSync();
    }
  };

  const content = (
    <>
      <View style={[styles.indicator, {backgroundColor: getStatusColor()}]}>
        {sync.isSyncing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.icon}>{getStatusIcon()}</Text>
        )}
      </View>
      
      {showDetails && (
        <View style={styles.details}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          <Text style={styles.connectionText}>
            {network.connectionDescription}
            {network.networkQuality !== 'excellent' && network.networkQuality !== 'offline' 
              ? ` (${network.networkQuality})`
              : ''
            }
          </Text>
        </View>
      )}
    </>
  );

  if (onPress || canSync) {
    return (
      <TouchableOpacity style={[styles.container, style]} onPress={handlePress}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {content}
    </View>
  );
};

interface NetworkBannerProps {
  style?: any;
}

export const NetworkBanner: React.FC<NetworkBannerProps> = ({style}) => {
  const {network, sync} = useConnectivity();

  // Only show banner when offline or has pending syncs
  if (network.isConnected && sync.pendingCount === 0) {
    return null;
  }

  const getBannerConfig = () => {
    if (!network.isConnected) {
      return {
        color: '#E74C3C',
        text: 'You\'re offline. Changes will sync when connection is restored.',
        icon: '⚠',
      };
    }
    
    if (sync.pendingCount > 0) {
      return {
        color: '#F39C12',
        text: `${sync.pendingCount} change${sync.pendingCount > 1 ? 's' : ''} waiting to sync`,
        icon: '⏸',
      };
    }

    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  return (
    <View style={[styles.banner, {backgroundColor: config.color}, style]}>
      <Text style={styles.bannerIcon}>{config.icon}</Text>
      <Text style={styles.bannerText}>{config.text}</Text>
      {sync.pendingCount > 0 && network.isConnected && (
        <TouchableOpacity 
          style={styles.syncButton}
          onPress={() => sync.forcSync()}
        >
          <Text style={styles.syncButtonText}>Sync Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  details: {
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C3E50',
  },
  connectionText: {
    fontSize: 10,
    color: '#7F8C8D',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
  },
  bannerIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    marginRight: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  syncButtonText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});