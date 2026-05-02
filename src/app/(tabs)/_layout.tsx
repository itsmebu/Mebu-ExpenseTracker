// app/(tabs)/_layout.tsx

import { Tabs, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { OfflineIndicator } from '../../../components/OfflineIndicator';

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tabs = [
    { name: 'home', icon: 'home', label: 'HOME' },
    { name: 'statistics', icon: 'bar-chart-2', label: 'STATS' },
    { name: 'recent-activity', icon: 'clock', label: 'HISTORY' },
    { name: 'pending-expenses', icon: 'credit-card', label: 'BILLS' },
    { name: 'shopping-list', icon: 'shopping-bag', label: 'SHOPPING' },
    { name: 'profile', icon: 'user', label: 'PROFILE' },
  ];

  const CustomTabBar = ({ state, descriptors, navigation }: any) => {
    return (
      <View style={{
        position: 'absolute',
        bottom: 20 + insets.bottom,
        left: 20,
        right: 20,
        backgroundColor: '#1a472a',
        borderRadius: 40,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#2a5a3a',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
        overflow: 'visible',
      }}>
        {/* Left side tabs (first 3) */}
        {tabs.slice(0, 3).map((tab, index) => {
          const isFocused = state.index === index;
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => navigation.navigate(tab.name)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 8,
              }}
            >
              <Icon 
                name={tab.icon} 
                size={22} 
                color={isFocused ? '#90ee90' : '#6a8a7a'} 
              />
              <Text style={{
                color: isFocused ? '#90ee90' : '#6a8a7a',
                fontSize: 10,
                fontFamily: 'Poppins-Regular',
                marginTop: 4,
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Center Plus Button */}
        <View style={{
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -38,
          width: 70,
          height: 70,
          borderRadius: 35,
          backgroundColor: 'transparent',
        }}>
          <View style={{
            position: 'absolute',
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: '#1a472a',
            top: 0,
          }} />
          
          <View style={{
            position: 'absolute',
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#1a472a',
            top: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.5,
            shadowRadius: 4,
            elevation: 5,
          }} />
          
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/add-expense')}
            style={{
              backgroundColor: '#90ee90',
              width: 54,
              height: 54,
              borderRadius: 27,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 2,
              borderColor: '#1a472a',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 5,
              elevation: 8,
              zIndex: 10,
            }}
          >
            <Icon name="plus" size={26} color="#1a472a" />
          </TouchableOpacity>
        </View>

        {/* Right side tabs (last 3) */}
        {tabs.slice(3, 6).map((tab, index) => {
          const actualIndex = index + 3;
          const isFocused = state.index === actualIndex;
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => navigation.navigate(tab.name)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 8,
              }}
            >
              <Icon 
                name={tab.icon} 
                size={22} 
                color={isFocused ? '#90ee90' : '#6a8a7a'} 
              />
              <Text style={{
                color: isFocused ? '#90ee90' : '#6a8a7a',
                fontSize: 10,
                fontFamily: 'Poppins-Regular',
                marginTop: 4,
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1a472a' }}>
      <OfflineIndicator />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
        tabBar={(props) => <CustomTabBar {...props} />}
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="statistics" options={{ title: 'Stats' }} />
        <Tabs.Screen name="recent-activity" options={{ title: 'Recent Activity' }} />
        <Tabs.Screen name="pending-expenses" options={{ title: 'Pending Bills' }} />
        <Tabs.Screen name="shopping-list" options={{ title: 'Shopping' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen 
          name="add-expense" 
          options={{ 
            title: 'Add Expense',
            href: null,
          }} 
        />
        <Tabs.Screen 
          name="categories" 
          options={{ 
            title: 'Categories',
            href: null,
          }} 
        />
        <Tabs.Screen 
          name="add-pending-expense" 
          options={{ 
            title: 'Add Bill',
            href: null,
          }} 
        />
      </Tabs>
    </View>
  );
}