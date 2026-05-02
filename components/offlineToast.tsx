import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

export default function OfflineToast() {
  const [visible, setVisible] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? true;
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Update offline status
      const offline = !connected;
      setIsOffline(offline);
      
      // Show notification
      setVisible(true);
      
      // Auto-hide after 3 seconds
      timeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 3000);
    });
    
    return () => {
      unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <View style={{
      position: 'absolute',
      top: 50,
      left: 20,
      right: 20,
      backgroundColor: '#1a472a',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: isOffline ? '#FFA500' : '#4ECDC4',
      zIndex: 1000,
    }}>
      <Icon 
        name={isOffline ? 'wifi-off' : 'wifi'} 
        size={18} 
        color={isOffline ? '#FFA500' : '#4ECDC4'} 
      />
      <Text style={{ flex: 1, color: '#ffffff', fontSize: 13 }}>
        {isOffline ? 'No Internet Connection' : 'Back Online'}
      </Text>
      <TouchableOpacity onPress={() => setVisible(false)}>
        <Icon name="x" size={14} color="#ffffff" opacity={0.7} />
      </TouchableOpacity>
    </View>
  );
}