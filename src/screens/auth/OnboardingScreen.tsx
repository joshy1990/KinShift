import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar, ScrollView} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const {width, height} = Dimensions.get('window');

// Responsive breakpoints
const isTablet = width >= 768;
const isDesktop = width >= 1024;
const isLargeScreen = width >= 1200;

// Dynamic sizing functions
const getResponsiveValue = (mobile: number, tablet: number, desktop: number) => {
  if (isDesktop) return desktop;
  if (isTablet) return tablet;
  return mobile;
};

const getMaxWidth = () => {
  if (isLargeScreen) return 600;
  if (isDesktop) return 500;
  if (isTablet) return 400;
  return width - 48;
};

export const OnboardingScreen: React.FC<Props> = ({navigation}) => {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F23" />
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.backgroundGradient} />
        
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <View style={styles.chainLink}>
                <View style={styles.chainLinkLeft} />
                <View style={styles.chainLinkRight} />
              </View>
            </View>
          </View>
          
          <Text style={styles.appName}>LinkShift</Text>
          <Text style={styles.tagline}>Smart Family Scheduling</Text>
          
          <Text style={styles.description}>
            Effortlessly coordinate work shifts, family time, and personal schedules.{'\n'}
            Stay connected, avoid conflicts, keep everyone in sync.
          </Text>
        </View>

        <View style={styles.featuresGrid}>
          <FeatureCard 
            icon="📅" 
            title="Smart Calendar" 
            description="Visual schedule management"
            color="#6366F1" 
          />
          <FeatureCard 
            icon="⚡" 
            title="Auto-Sync" 
            description="Real-time updates everywhere"
            color="#F59E0B" 
          />
          <FeatureCard 
            icon="🔔" 
            title="Smart Alerts" 
            description="Never miss important shifts"
            color="#EF4444" 
          />
          <FeatureCard 
            icon="👥" 
            title="Family Hub" 
            description="Connect your whole household"
            color="#10B981" 
          />
        </View>

        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Get Started Free</Text>
            <Text style={styles.buttonArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}>
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
};

const FeatureCard: React.FC<{
  icon: string; 
  title: string; 
  description: string; 
  color: string;
}> = ({icon, title, description, color}) => (
  <View style={[styles.featureCard, {borderLeftColor: color}]}>
    <View style={styles.featureHeader}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
    </View>
    <Text style={styles.featureDescription}>{description}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 40,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.6,
    backgroundColor: '#1A1A2E',
    borderBottomLeftRadius: getResponsiveValue(40, 50, 60),
    borderBottomRightRadius: getResponsiveValue(40, 50, 60),
  },
  desktopContainer: {
    flexDirection: 'row',
    maxWidth: isLargeScreen ? 1200 : 1000,
    width: '100%',
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: getResponsiveValue(24, 40, 60),
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: getResponsiveValue(24, 40, 60),
    paddingTop: getResponsiveValue(60, 80, 100),
    paddingBottom: getResponsiveValue(40, 50, 60),
    maxWidth: getMaxWidth(),
    width: '100%',
  },
  heroSectionDesktop: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: 40,
    maxWidth: 600,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: getResponsiveValue(24, 32, 40),
  },
  logoCircle: {
    width: getResponsiveValue(100, 110, 120),
    height: getResponsiveValue(100, 110, 120),
    borderRadius: getResponsiveValue(50, 55, 60),
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 12,
  },
  chainLink: {
    width: getResponsiveValue(50, 55, 60),
    height: getResponsiveValue(50, 55, 60),
    position: 'relative',
    transform: [{rotate: '45deg'}],
  },
  chainLinkLeft: {
    position: 'absolute',
    width: getResponsiveValue(25, 27, 30),
    height: getResponsiveValue(40, 44, 48),
    borderWidth: getResponsiveValue(5, 6, 6),
    borderColor: '#60A5FA',
    borderRadius: getResponsiveValue(12, 13, 15),
    left: 0,
    top: getResponsiveValue(5, 5, 6),
  },
  chainLinkRight: {
    position: 'absolute',
    width: getResponsiveValue(25, 27, 30),
    height: getResponsiveValue(40, 44, 48),
    borderWidth: getResponsiveValue(5, 6, 6),
    borderColor: '#818CF8',
    borderRadius: getResponsiveValue(12, 13, 15),
    right: 0,
    top: getResponsiveValue(5, 5, 6),
  },
  logoIcon: {
    fontSize: getResponsiveValue(24, 28, 32),
    color: '#6366F1',
    fontWeight: 'bold',
  },
  appName: {
    fontSize: getResponsiveValue(32, 36, 42),
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -1,
    textAlign: isDesktop ? 'left' : 'center',
  },
  tagline: {
    fontSize: getResponsiveValue(14, 16, 18),
    color: '#A1A1AA',
    marginBottom: getResponsiveValue(20, 24, 32),
    fontWeight: '500',
    textAlign: isDesktop ? 'left' : 'center',
  },
  description: {
    fontSize: getResponsiveValue(15, 16, 17),
    color: '#A1A1AA',
    textAlign: isDesktop ? 'left' : 'center',
    lineHeight: getResponsiveValue(22, 24, 26),
    paddingHorizontal: isDesktop ? 0 : 12,
    maxWidth: isDesktop ? 480 : '100%',
    marginBottom: getResponsiveValue(8, 16, 24),
  },
  featuresGrid: {
    paddingHorizontal: getResponsiveValue(24, 32, 40),
    paddingVertical: getResponsiveValue(24, 32, 40),
    gap: getResponsiveValue(12, 14, 16),
    maxWidth: getMaxWidth(),
    width: '100%',
    marginBottom: getResponsiveValue(24, 32, 40),
  },
  featuresGridDesktop: {
    flex: 1,
    paddingLeft: 40,
    paddingVertical: getResponsiveValue(24, 32, 40),
    gap: getResponsiveValue(16, 20, 24),
    maxWidth: 500,
  },
  featureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: getResponsiveValue(12, 14, 16),
    padding: getResponsiveValue(16, 18, 20),
    borderLeftWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featureDescription: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
  },
  ctaSection: {
    paddingHorizontal: isDesktop ? 0 : getResponsiveValue(24, 32, 40),
    paddingBottom: getResponsiveValue(40, 50, 60),
    paddingTop: getResponsiveValue(20, 30, 40),
    gap: getResponsiveValue(16, 20, 24),
    maxWidth: getMaxWidth(),
    width: '100%',
    alignItems: 'center',
    marginBottom: getResponsiveValue(30, 40, 50),
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    paddingVertical: getResponsiveValue(16, 18, 20),
    paddingHorizontal: getResponsiveValue(28, 32, 36),
    borderRadius: getResponsiveValue(12, 14, 16),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    width: '100%',
    maxWidth: 320,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: getResponsiveValue(16, 18, 20),
    fontWeight: '700',
    marginRight: 8,
  },
  buttonArrow: {
    color: '#FFFFFF',
    fontSize: getResponsiveValue(16, 18, 20),
    fontWeight: 'bold',
  },
  secondaryButton: {
    paddingVertical: getResponsiveValue(16, 18, 20),
    paddingHorizontal: getResponsiveValue(28, 32, 36),
    borderRadius: getResponsiveValue(12, 14, 16),
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
    maxWidth: 320,
  },
  secondaryButtonText: {
    color: '#A1A1AA',
    fontSize: getResponsiveValue(14, 16, 18),
    fontWeight: '600',
  },
});
