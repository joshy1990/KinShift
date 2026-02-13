import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

export const PrivacyPolicyScreen: React.FC<Props> = ({navigation}) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.effectiveDate}>Effective Date: February 13, 2026</Text>
        <Text style={styles.effectiveDate}>Last Updated: February 13, 2026</Text>

        <Text style={styles.paragraph}>
          Welcome to KinShift! This Privacy Policy explains how we collect, use, disclose, and safeguard
          your information when you use our mobile application.
        </Text>

        <Text style={styles.contact}>
          <Text style={styles.bold}>Contact:</Text> joshlee_990@hotmail.co.uk
        </Text>

        <Text style={styles.heading}>Information We Collect</Text>

        <Text style={styles.subheading}>1. Personal Information</Text>
        <Text style={styles.paragraph}>
          When you register for KinShift, we collect:
        </Text>
        <Text style={styles.listItem}>• Email address (required for account creation)</Text>
        <Text style={styles.listItem}>• Display name (optional)</Text>
        <Text style={styles.listItem}>• Password (encrypted, never stored in plain text)</Text>

        <Text style={styles.subheading}>2. Shift Data</Text>
        <Text style={styles.paragraph}>
          When you use the app, we store:
        </Text>
        <Text style={styles.listItem}>• Shift titles, start times, end times</Text>
        <Text style={styles.listItem}>• Notes and descriptions</Text>
        <Text style={styles.listItem}>• Day notes and household communications</Text>
        <Text style={styles.listItem}>• Household membership information</Text>

        <Text style={styles.subheading}>3. Automatically Collected Information</Text>
        <Text style={styles.listItem}>• Device type and operating system</Text>
        <Text style={styles.listItem}>• Crash reports and error diagnostics (via Sentry)</Text>

        <Text style={styles.heading}>How We Use Your Information</Text>

        <Text style={styles.paragraph}>We use your information to:</Text>
        <Text style={styles.listItem}>• Provide and maintain the app functionality</Text>
        <Text style={styles.listItem}>• Authenticate your account and manage access</Text>
        <Text style={styles.listItem}>• Store and sync your shifts and notes</Text>
        <Text style={styles.listItem}>• Enable household sharing features</Text>
        <Text style={styles.listItem}>• Send notifications about shift changes</Text>
        <Text style={styles.listItem}>• Improve app performance and fix bugs</Text>

        <Text style={styles.heading}>Data Storage & Security</Text>

        <Text style={styles.subheading}>Firebase Services</Text>
        <Text style={styles.paragraph}>
          KinShift uses Google Firebase for backend services:
        </Text>
        <Text style={styles.listItem}>• Firebase Authentication (for user accounts)</Text>
        <Text style={styles.listItem}>• Cloud Firestore (for data storage)</Text>
        <Text style={styles.listItem}>• Firebase Cloud Messaging (for notifications)</Text>

        <Text style={styles.paragraph}>
          Your data is stored on Google's secure servers. Firebase is SOC 2, SOC 3, and ISO 27001
          certified. Data is encrypted in transit (HTTPS) and at rest.
        </Text>

        <Text style={styles.heading}>Data Sharing & Disclosure</Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>We DO NOT sell your personal information.</Text>
        </Text>

        <Text style={styles.paragraph}>We may share data only in these cases:</Text>
        <Text style={styles.listItem}>• With household members (when you join a household)</Text>
        <Text style={styles.listItem}>• With service providers (Google Firebase)</Text>
        <Text style={styles.listItem}>• When required by law or to protect rights</Text>

        <Text style={styles.heading}>Your Rights & Choices</Text>

        <Text style={styles.subheading}>Access & Export</Text>
        <Text style={styles.paragraph}>
          You can view all your data in the app. Contact us to request a data export.
        </Text>

        <Text style={styles.subheading}>Deletion</Text>
        <Text style={styles.paragraph}>
          You can delete your account at any time via Settings → Delete Account. This permanently removes:
        </Text>
        <Text style={styles.listItem}>• Your account and authentication data</Text>
        <Text style={styles.listItem}>• All your shifts and personal notes</Text>
        <Text style={styles.listItem}>• Your household memberships</Text>

        <Text style={styles.heading}>Children's Privacy</Text>

        <Text style={styles.paragraph}>
          KinShift is not intended for users under 16. We do not knowingly collect information from children
          under 16. If you believe we have collected data from a child, contact us immediately.
        </Text>

        <Text style={styles.heading}>Changes to This Policy</Text>

        <Text style={styles.paragraph}>
          We may update this Privacy Policy periodically. Changes will be posted in the app with an updated
          "Last Updated" date. Continued use after changes constitutes acceptance.
        </Text>

        <Text style={styles.heading}>Contact Us</Text>

        <Text style={styles.paragraph}>
          Questions about this Privacy Policy? Contact us:
        </Text>
        <Text style={styles.contact}>
          <Text style={styles.bold}>Email:</Text> joshlee_990@hotmail.co.uk
        </Text>

        <Text style={styles.summary}>
          <Text style={styles.bold}>Summary (TL;DR)</Text>
          {'\n\n'}
          ✅ We collect: email, name, shift data{'\n'}
          🔒 Stored securely on Firebase (Google){'\n'}
          ❌ We don't sell your data{'\n'}
          🗑️ You can delete your account anytime{'\n'}
          📧 Questions? joshlee_990@hotmail.co.uk
        </Text>

        <Text style={styles.footer}>
          This Privacy Policy is provided for transparency and legal compliance. For production use serving
          many users, consult a legal professional to ensure compliance with all applicable laws (GDPR, CCPA, etc.).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E3F',
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    color: '#6366F1',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  effectiveDate: {
    fontSize: 12,
    color: '#8B8B9F',
    marginBottom: 4,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 12,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C4C4D4',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#B4B4C8',
    lineHeight: 22,
    marginBottom: 12,
  },
  listItem: {
    fontSize: 14,
    color: '#B4B4C8',
    lineHeight: 22,
    marginBottom: 6,
    paddingLeft: 8,
  },
  bold: {
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  contact: {
    fontSize: 14,
    color: '#6366F1',
    marginBottom: 12,
  },
  summary: {
    fontSize: 14,
    color: '#B4B4C8',
    backgroundColor: '#1E1E3F',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    lineHeight: 22,
  },
  footer: {
    fontSize: 12,
    color: '#8B8B9F',
    fontStyle: 'italic',
    marginTop: 24,
    lineHeight: 18,
  },
});
