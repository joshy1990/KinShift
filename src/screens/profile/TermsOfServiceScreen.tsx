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

type Props = NativeStackScreenProps<RootStackParamList, 'TermsOfService'>;

export const TermsOfServiceScreen: React.FC<Props> = ({navigation}) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.effectiveDate}>Effective Date: October 15, 2025</Text>
        <Text style={styles.effectiveDate}>Last Updated: October 15, 2025</Text>

        <Text style={styles.heading}>Agreement to Terms</Text>
        <Text style={styles.paragraph}>
          By accessing or using LinkShift ("the App"), you agree to be bound by these Terms of Service
          ("Terms"). If you do not agree to these Terms, do not use the App.
        </Text>

        <Text style={styles.contact}>
          <Text style={styles.bold}>Contact:</Text> support@linkshift.app
        </Text>

        <Text style={styles.heading}>About LinkShift</Text>
        <Text style={styles.paragraph}>
          LinkShift is a personal project created to help families and shift workers manage schedules. It is
          provided "as-is" without warranties. This is not a commercial service.
        </Text>

        <Text style={styles.heading}>Eligibility</Text>
        <Text style={styles.listItem}>• You must be at least 16 years old to use LinkShift</Text>
        <Text style={styles.listItem}>• You must provide accurate information when creating an account</Text>
        <Text style={styles.listItem}>• You must comply with all local laws regarding internet usage</Text>

        <Text style={styles.heading}>Account Responsibilities</Text>

        <Text style={styles.subheading}>Your Account</Text>
        <Text style={styles.listItem}>• You are responsible for maintaining the security of your account</Text>
        <Text style={styles.listItem}>• You must keep your password confidential</Text>
        <Text style={styles.listItem}>• You are responsible for all activities under your account</Text>
        <Text style={styles.listItem}>• You must notify us immediately of any unauthorized access</Text>

        <Text style={styles.subheading}>Prohibited Activities</Text>
        <Text style={styles.paragraph}>You agree NOT to:</Text>
        <Text style={styles.listItem}>• Use the App for illegal purposes</Text>
        <Text style={styles.listItem}>• Harass, abuse, or harm other users</Text>
        <Text style={styles.listItem}>• Attempt to hack, disrupt, or gain unauthorized access</Text>
        <Text style={styles.listItem}>• Upload malicious code or viruses</Text>
        <Text style={styles.listItem}>• Impersonate others or create fake accounts</Text>
        <Text style={styles.listItem}>• Scrape or automate access to the App</Text>

        <Text style={styles.heading}>Your Content</Text>
        <Text style={styles.paragraph}>
          You retain ownership of the shift data, notes, and content you create. By using the App, you grant
          us a license to store and display your content.
        </Text>

        <Text style={styles.heading}>Data & Privacy</Text>
        <Text style={styles.paragraph}>
          Your use of LinkShift is also governed by our Privacy Policy. Key points:
        </Text>
        <Text style={styles.listItem}>• We collect email, name, and shift data</Text>
        <Text style={styles.listItem}>• Data is stored on Firebase (Google)</Text>
        <Text style={styles.listItem}>• We do not sell your data</Text>
        <Text style={styles.listItem}>• You can delete your account anytime</Text>

        <Text style={styles.heading}>Household Features</Text>

        <Text style={styles.subheading}>Creating/Joining Households</Text>
        <Text style={styles.listItem}>• You can create or join households to share schedules</Text>
        <Text style={styles.listItem}>• Household members can see each other's shifts and notes</Text>
        <Text style={styles.listItem}>• Household admins can manage members and settings</Text>

        <Text style={styles.subheading}>Household Responsibilities</Text>
        <Text style={styles.listItem}>• Be respectful to other household members</Text>
        <Text style={styles.listItem}>• Do not share sensitive information without consent</Text>
        <Text style={styles.listItem}>• You can leave a household at any time</Text>

        <Text style={styles.heading}>Disclaimer of Warranties</Text>
        <Text style={styles.paragraph}>
          LinkShift is provided <Text style={styles.bold}>"AS-IS"</Text> and{' '}
          <Text style={styles.bold}>"AS AVAILABLE"</Text> without warranties of any kind:
        </Text>
        <Text style={styles.listItem}>• No guarantee of availability or uptime</Text>
        <Text style={styles.listItem}>• No guarantee of accuracy of shift data</Text>
        <Text style={styles.listItem}>• No guarantee of complete security</Text>
        <Text style={styles.listItem}>• No liability for data loss</Text>

        <Text style={styles.warningBox}>
          <Text style={styles.bold}>THIS IS A PERSONAL PROJECT, NOT A COMMERCIAL SERVICE. USE AT YOUR OWN RISK.</Text>
        </Text>

        <Text style={styles.heading}>Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          To the maximum extent permitted by law:
        </Text>
        <Text style={styles.listItem}>• We are not liable for any indirect or consequential damages</Text>
        <Text style={styles.listItem}>• We are not liable for lost profits or data loss</Text>
        <Text style={styles.listItem}>• Our total liability is limited to $100 USD</Text>
        <Text style={styles.listItem}>• We are not liable for third-party services (Firebase, etc.)</Text>

        <Text style={styles.heading}>Termination</Text>

        <Text style={styles.subheading}>By You</Text>
        <Text style={styles.paragraph}>You can stop using LinkShift at any time by:</Text>
        <Text style={styles.listItem}>• Deleting your account in app settings</Text>
        <Text style={styles.listItem}>• Emailing us at: support@linkshift.app</Text>

        <Text style={styles.subheading}>By Us</Text>
        <Text style={styles.paragraph}>We may suspend or terminate your account if:</Text>
        <Text style={styles.listItem}>• You violate these Terms</Text>
        <Text style={styles.listItem}>• You engage in fraudulent or illegal activity</Text>
        <Text style={styles.listItem}>• We discontinue the App</Text>

        <Text style={styles.heading}>Changes to Terms</Text>
        <Text style={styles.paragraph}>
          We may update these Terms at any time. Changes will be posted in the app with an updated "Last
          Updated" date. Continued use after changes constitutes acceptance.
        </Text>

        <Text style={styles.heading}>Contact Us</Text>
        <Text style={styles.paragraph}>For questions about these Terms:</Text>
        <Text style={styles.contact}>
          <Text style={styles.bold}>Email:</Text> support@linkshift.app
        </Text>
        <Text style={styles.paragraph}>We will respond within 30 days.</Text>

        <Text style={styles.summary}>
          <Text style={styles.bold}>Summary (TL;DR)</Text>
          {'\n\n'}
          ✅ You can: Use the app for shift planning, create households{'\n'}
          ❌ You can't: Hack, spam, harass, or use illegally{'\n'}
          🔒 Your data: You own it, we store it securely{'\n'}
          ⚠️ Disclaimer: App provided "as-is", use at your own risk{'\n'}
          📧 Problems? support@linkshift.app{'\n'}
          🗑️ Leave: Delete account anytime
        </Text>

        <Text style={styles.footer}>
          By using LinkShift, you agree to these Terms.
          {'\n\n'}
          These Terms of Service are provided for LinkShift. For production apps serving many users, consult
          a legal professional to ensure compliance with all applicable laws.
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
  warningBox: {
    fontSize: 14,
    color: '#FFA500',
    backgroundColor: '#2A1A0F',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
    marginVertical: 16,
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
