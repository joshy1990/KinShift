import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface RoleBadgeProps {
  role: 'admin' | 'member';
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  size = 'medium',
  showIcon = true,
}) => {
  const isAdmin = role === 'admin';
  
  const sizeStyles = {
    small: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      fontSize: 10,
    },
    medium: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      fontSize: 12,
    },
    large: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      fontSize: 14,
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={[
        styles.badge,
        isAdmin ? styles.adminBadge : styles.memberBadge,
        {
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
        },
      ]}>
      {showIcon && (
        <Text style={[styles.icon, {fontSize: currentSize.fontSize}]}>
          {isAdmin ? '👑' : '👤'}
        </Text>
      )}
      <Text
        style={[
          styles.text,
          isAdmin ? styles.adminText : styles.memberText,
          {fontSize: currentSize.fontSize},
        ]}>
        {isAdmin ? 'Admin' : 'Member'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    gap: 4,
  },
  adminBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  memberBadge: {
    backgroundColor: '#E0E7FF',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  icon: {
    lineHeight: 16,
  },
  text: {
    fontWeight: '600',
  },
  adminText: {
    color: '#92400E',
  },
  memberText: {
    color: '#3730A3',
  },
});
