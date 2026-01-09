import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';

interface OfflineScreenProps {
  message?: string;
}

export default function OfflineScreen({ message = "This feature requires an internet connection. Please check your connection and try again." }: OfflineScreenProps) {
  return (
    <View style={styles.container}>
      <WifiOff size={100} color="#9AA0A6" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  message: {
    fontSize: 16,
    color: '#5F6368',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 24,
  },
});