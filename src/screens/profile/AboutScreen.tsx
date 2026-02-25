/**
 * About Screen
 * Shows app information, version, and links
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Linking,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/types';
import {spacing, typography, borderRadius} from '@/utils/responsive';
import {showError} from '@/utils/alert';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const AboutScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showError(`Cannot open URL: ${url}`);
      }
    } catch (error) {
      console.error('Error opening link:', error);
      showError('Failed to open link');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Icon */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <View style={styles.chainLink}>
              <View style={styles.chainLinkLeft} />
              <View style={styles.chainLinkRight} />
            </View>
          </View>
          <Text style={styles.appName}>KinShift</Text>
          <Text style={styles.version}>Version 1.0.0 (MVP)</Text>
          <Text style={styles.subtitle}>Family Shift Coordination App</Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.description}>
            KinShift helps families coordinate work shifts, appointments, and schedules. 
            Share your calendar with family members, avoid scheduling conflicts, and stay organized together.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Shared household calendars</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Real-time shift updates</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Conflict detection</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Multi-device sync</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Customizable notifications</Text>
            </View>
          </View>
        </View>

        {/* Technology */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Built With</Text>
          <Text style={styles.techText}>React Native • Expo • Firebase</Text>
          <Text style={styles.techText}>TypeScript • React Navigation</Text>
        </View>

        {/* Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Legal</Text>
          
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => handleOpenLink('mailto:support@offeryn.co.uk')}>
            <Text style={styles.linkText}>Contact Support</Text>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('PrivacyPolicy')}>
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('TermsOfService')}>
            <Text style={styles.linkText}>Terms of Service</Text>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Copyright */}
        <View style={styles.footer}>
          <Text style={styles.copyright}>© 2026 Offeryn Software Ltd</Text>
          <Text style={styles.footerText}>Made with ❤️ for families and shift workers</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 12,
  },
  chainLink: {
    width: 50,
    height: 50,
    position: 'relative',
    transform: [{rotate: '45deg'}],
  },
  chainLinkLeft: {
    position: 'absolute',
    width: 25,
    height: 40,
    borderWidth: 5,
    borderColor: '#60A5FA',
    borderRadius: 12,
    left: 0,
    top: 5,
  },
  chainLinkRight: {
    position: 'absolute',
    width: 25,
    height: 40,
    borderWidth: 5,
    borderColor: '#818CF8',
    borderRadius: 12,
    right: 0,
    top: 5,
  },
  logoIcon: {
    fontSize: 32,
    color: '#6366F1',
    fontWeight: 'bold',
  },
  appName: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  version: {
    fontSize: typography.caption,
    color: '#6366F1',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.body,
    color: '#A1A1AA',
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: typography.body,
    color: '#A1A1AA',
    lineHeight: 24,
  },
  featureList: {
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureBullet: {
    fontSize: typography.bodyLarge,
    color: '#6366F1',
    marginRight: spacing.sm,
  },
  featureText: {
    fontSize: typography.body,
    color: '#D4D4D8',
  },
  techText: {
    fontSize: typography.body,
    color: '#A1A1AA',
    marginBottom: spacing.xs,
  },
  linkButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  linkText: {
    fontSize: typography.body,
    color: '#FFFFFF',
  },
  linkArrow: {
    fontSize: typography.bodyLarge,
    color: '#6366F1',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  copyright: {
    fontSize: typography.caption,
    color: '#666',
    marginBottom: spacing.xs,
  },
  footerText: {
    fontSize: typography.caption,
    color: '#666',
  },
});
