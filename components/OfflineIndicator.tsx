import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import NetInfo from '@react-native-community/netinfo';

// Named export - matches your import { OfflineIndicator }
export function OfflineIndicator() {
  const [visible, setVisible] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showNotification = (offline: boolean) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsOffline(offline);
    setVisible(true);
    
    // Animate in
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide after 3 seconds
    timeoutRef.current = setTimeout(() => {
      hideNotification();
    }, 3000);
  };

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? true;
      const offline = !connected;
      showNotification(offline);
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
    <Animated.View
      style={{
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        transform: [{ translateY: slideAnim }],
        opacity: fadeAnim,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
      }}
    >
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={() => hideNotification()}
      >
        <View style={{
          backgroundColor: '#1a472a',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderWidth: 1,
          borderColor: isOffline ? '#FFA500' : '#4ECDC4',
        }}>
          <Icon 
            name={isOffline ? 'wifi-off' : 'wifi'} 
            size={20} 
            color={isOffline ? '#FFA500' : '#4ECDC4'} 
          />
          
          <Text style={{
            flex: 1,
            color: '#ffffff',
            fontSize: 14,
            fontFamily: 'Poppins-Regular',
          }}>
            {isOffline ? 'No Internet Connection' : 'Back Online!'}
          </Text>
          
          <TouchableOpacity onPress={hideNotification}>
            <Icon name="x" size={16} color="#ffffff" opacity={0.7} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}