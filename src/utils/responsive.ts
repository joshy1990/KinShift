import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Responsive breakpoints
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  largeDesktop: 1200,
} as const;

// Device type detection
export const isTablet = width >= BREAKPOINTS.tablet;
export const isDesktop = width >= BREAKPOINTS.desktop;
export const isLargeDesktop = width >= BREAKPOINTS.largeDesktop;

// Responsive value helper
export const getResponsiveValue = (
  mobile: number,
  tablet: number = mobile,
  desktop: number = tablet,
  largeDesktop: number = desktop
): number => {
  if (isLargeDesktop) return largeDesktop;
  if (isDesktop) return desktop;
  if (isTablet) return tablet;
  return mobile;
};

// Maximum width helpers
export const getMaxContentWidth = (): number => {
  if (isLargeDesktop) return 600;
  if (isDesktop) return 500;
  if (isTablet) return 400;
  return width - 48;
};

export const getMaxFormWidth = (): number => {
  if (isDesktop) return 450;
  if (isTablet) return 400;
  return width - 48;
};

// Screen dimensions
export const screenWidth = width;
export const screenHeight = height;

// Responsive spacing
export const spacing = {
  xs: getResponsiveValue(4, 6, 8),
  sm: getResponsiveValue(8, 12, 16),
  md: getResponsiveValue(16, 20, 24),
  lg: getResponsiveValue(24, 32, 40),
  xl: getResponsiveValue(32, 40, 48),
  xxl: getResponsiveValue(40, 50, 60),
};

// Responsive typography
export const typography = {
  caption: getResponsiveValue(12, 13, 14),
  body: getResponsiveValue(14, 16, 18),
  bodyLarge: getResponsiveValue(16, 18, 20),
  subtitle: getResponsiveValue(18, 20, 22),
  title: getResponsiveValue(20, 22, 24),
  heading: getResponsiveValue(24, 28, 32),
  display: getResponsiveValue(32, 36, 42),
};

// Responsive border radius
export const borderRadius = {
  sm: getResponsiveValue(8, 10, 12),
  md: getResponsiveValue(12, 16, 20),
  lg: getResponsiveValue(16, 20, 24),
  xl: getResponsiveValue(20, 24, 28),
};