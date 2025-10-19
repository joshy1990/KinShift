import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HouseholdStackParamList, Household} from '@/types';
import {householdService} from '@/services/household.service';
import {useAuth} from '@/contexts/AuthContext';

type Props = NativeStackScreenProps<HouseholdStackParamList, 'HouseholdList'>;

export const HouseholdListScreen: React.FC<Props> = ({navigation}) => {
  const {user} = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHouseholds = useCallback(async () => {
    if (!user) return;

    try {
      const userHouseholds = await householdService.getUserHouseholds(user.id);
      setHouseholds(userHouseholds);
    } catch (error) {
      console.error('Failed to load households:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadHouseholds();
  }, [user, loadHouseholds]);

  // Reload households when screen comes into focus (e.g., after leaving a household)
  useFocusEffect(
    useCallback(() => {
      loadHouseholds();
    }, [loadHouseholds])
  );

  // Memoize render function
  const renderHouseholdCard = useCallback(({item}: {item: Household}) => (
    <TouchableOpacity
      style={styles.householdCard}
      onPress={() => navigation.navigate('HouseholdDetail', {householdId: item.id})}>
      <View style={styles.householdHeader}>
        <Text style={styles.householdName}>{item.name}</Text>
        <Text style={styles.memberCount}>
          {item.members.length} {item.members.length === 1 ? 'member' : 'members'}
        </Text>
      </View>
      <View style={styles.householdFooter}>
        <View style={styles.joinCodeContainer}>
          <Text style={styles.joinCodeLabel}>Join Code:</Text>
          <Text style={styles.joinCode}>{item.joinCode}</Text>
        </View>
        {item.admins.includes(user?.id || '') && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  ), [navigation, user?.id]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading households...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Households</Text>
      </View>

      {households.length > 0 ? (
        <FlatList
          data={households}
          renderItem={renderHouseholdCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Households Yet</Text>
          <Text style={styles.emptyDescription}>
            Create your first household or join an existing one using a join code
          </Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('CreateHousehold')}>
          <Text style={styles.buttonText}>Create New Household</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate('JoinHousehold')}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Join Household</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F23',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#A1A1AA',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  householdCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  householdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  householdName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  memberCount: {
    fontSize: 14,
    color: '#A1A1AA',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  householdFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  joinCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinCodeLabel: {
    fontSize: 14,
    color: '#A1A1AA',
    marginRight: 8,
  },
  joinCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
    fontFamily: 'monospace',
  },
  adminBadge: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    padding: 16,
    backgroundColor: '#1A1A2E',
    borderTopWidth: 1,
    borderTopColor: '#2A2A3E',
  },
  button: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  secondaryButtonText: {
    color: '#6366F1',
  },
});
