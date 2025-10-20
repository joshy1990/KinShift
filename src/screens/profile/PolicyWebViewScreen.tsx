import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { WebView } from 'react-native-webview';

type Props = NativeStackScreenProps<RootStackParamList> & {
  route: { params: { htmlAsset: 'privacy' | 'terms' } }
};

export const PolicyWebViewScreen: React.FC<Props> = ({ navigation, route }) => {
  const asset = route.params?.htmlAsset || 'privacy';
  const source = Platform.select({
    ios: { uri: `assets/policies/${asset}.html` },
    android: { uri: `file:///android_asset/policies/${asset}.html` },
    default: { uri: `assets/policies/${asset}.html` },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{asset === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}</Text>
      </View>
      <WebView originWhitelist={["*"]} source={source as any} style={{ flex: 1 }} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F23' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E1E3F',
  },
  backButton: { marginRight: 12 },
  backButtonText: { color: '#6366F1', fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
});
