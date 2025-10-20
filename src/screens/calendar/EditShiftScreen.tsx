import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CalendarStackParamList} from '@/types';

type Props = NativeStackScreenProps<CalendarStackParamList, 'EditShift'>;

export const EditShiftScreen: React.FC<Props> = ({route}) => {
  const {shiftId} = route.params;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Shift</Text>
      <Text>Shift ID: {shiftId}</Text>
      <Text>Form coming soon...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
});
