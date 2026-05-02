// app/(tabs)/statistics.tsx

import NetInfo from '@react-native-community/netinfo';
import { Picker } from '@react-native-picker/picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Modal, RefreshControl, SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Feather';
import { Expense, getCategories, getExpenses } from '../../../store/expenses';
import { getShoppingItems, ShoppingItem } from '../../../store/shoppingList';
const { width, height } = Dimensions.get('window');

const AVAILABLE_CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Bills', 
  'Entertainment', 'Health', 'Education', 'Other'
];

export default function StatisticsScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [categories, setCategories] = useState<string[]>(AVAILABLE_CATEGORIES);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [dailySpending, setDailySpending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalSpending, setTotalSpending] = useState(0);
  const [totalShopping, setTotalShopping] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedMonthPicker, setSelectedMonthPicker] = useState(selectedDate.getMonth());
  const [selectedYearPicker, setSelectedYearPicker] = useState(selectedDate.getFullYear());
  const [isOffline, setIsOffline] = useState(false);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  useEffect(() => {
    loadData();
    
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if ((expenses.length > 0 || shoppingItems.length > 0) || !loading) {
      processData();
    }
  }, [expenses, shoppingItems, selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allExpenses, allShoppingItems, savedCategories] = await Promise.all([
        getExpenses(),
        getShoppingItems(),
        getCategories()
      ]);
      setExpenses(allExpenses);
      setShoppingItems(allShoppingItems);
      
      if (savedCategories && savedCategories.length > 0) {
        setCategories(savedCategories.map(cat => cat.name));
      }
      
      updateMonthLabel(selectedDate);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const updateMonthLabel = (date: Date) => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    setSelectedMonth(`${monthNames[date.getMonth()]} ${date.getFullYear()}`);
  };

  const handleDateSelect = useCallback((day: number) => {
    const newDate = new Date(selectedYearPicker, selectedMonthPicker, day);
    setSelectedDate(newDate);
    updateMonthLabel(newDate);
    setShowDatePicker(false);
  }, [selectedMonthPicker, selectedYearPicker]);

  const handleMonthChange = useCallback((itemValue: number) => {
    setSelectedMonthPicker(itemValue);
  }, []);

  const handleYearChange = useCallback((itemValue: number) => {
    setSelectedYearPicker(itemValue);
  }, []);

  const handleApplyDate = useCallback(() => {
    const daysInMonth = new Date(selectedYearPicker, selectedMonthPicker + 1, 0).getDate();
    let newDay = selectedDate.getDate();
    if (newDay > daysInMonth) {
      newDay = daysInMonth;
    }
    const newDate = new Date(selectedYearPicker, selectedMonthPicker, newDay);
    setSelectedDate(newDate);
    updateMonthLabel(newDate);
    setShowDatePicker(false);
  }, [selectedMonthPicker, selectedYearPicker, selectedDate]);

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const processData = () => {
    const filteredExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.date);
      return expDate.getMonth() === selectedDate.getMonth() && 
             expDate.getFullYear() === selectedDate.getFullYear();
    });

    const filteredShopping = shoppingItems.filter(item => {
      if (!item.completed) return false;
      const purchaseDate = item.completedAt ? new Date(item.completedAt) : new Date(item.createdAt);
      return purchaseDate.getMonth() === selectedDate.getMonth() && 
             purchaseDate.getFullYear() === selectedDate.getFullYear();
    });

    const expensesTotal = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const shoppingTotalAmount = filteredShopping.reduce((sum, item) => sum + item.price, 0);
    const total = expensesTotal + shoppingTotalAmount;
    
    setTotalExpenses(expensesTotal);
    setTotalShopping(shoppingTotalAmount);
    setTotalSpending(total);

    const categoryMap = new Map();
    
    categories.forEach(category => {
      categoryMap.set(category, 0);
    });
    
    filteredExpenses.forEach(exp => {
      const category = exp.category || 'Other';
      const currentAmount = categoryMap.get(category) || 0;
      categoryMap.set(category, currentAmount + exp.amount);
    });
    
    filteredShopping.forEach(item => {
      const category = item.category || 'Shopping';
      const currentAmount = categoryMap.get(category) || 0;
      categoryMap.set(category, currentAmount + item.price);
    });

    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFEAA7', '#DDA0DD',
      '#98D8C8', '#F7D794', '#778BEB', '#E77F67', '#F3A683',
      '#F8A5C2', '#63CDDA', '#FDA7DF', '#ED4C67', '#6F1A51',
      '#EE5A24', '#0ABDE3', '#F9CA24', '#7ED6DF', '#C44569'
    ];
    
    let colorIndex = 0;
    
    const pieData = Array.from(categoryMap.entries())
      .filter(([_, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name: name,
        amount: amount,
        color: colors[colorIndex++ % colors.length],
        percentage: ((amount / total) * 100).toFixed(1)
      }));

    setChartData(pieData);

    const dailyData = [];
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i);
      
      const dayExpenses = filteredExpenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate.getDate() === i;
      });
      const expensesTotalDay = dayExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      const dayShopping = filteredShopping.filter(item => {
        const purchaseDate = item.completedAt ? new Date(item.completedAt) : new Date(item.createdAt);
        return purchaseDate.getDate() === i;
      });
      const shoppingTotalDay = dayShopping.reduce((sum, item) => sum + item.price, 0);
      
      const dayTotal = expensesTotalDay + shoppingTotalDay;
      
      if (dayTotal > 0) {
        dailyData.push({
          day: i,
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
          amount: dayTotal,
        });
      }
    }
    
    dailyData.sort((a, b) => a.day - b.day);
    setDailySpending(dailyData);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const DonutChartWithTotal = ({ data, size = 220 }: { data: any[]; size?: number }) => {
    if (!data || data.length === 0) {
      return (
        <View style={{ height: size, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="pie-chart" size={50} color="#90ee90" />
          <Text style={{ color: '#c0e0c0', fontFamily: 'Poppins-Regular', marginTop: 10, textAlign: 'center' }}>
            No data for this month
          </Text>
        </View>
      );
    }

    const center = size / 2;
    const radius = size / 2.2;
    const holeRadius = radius / 1.6;
    const grandTotal = totalSpending;
    let currentAngle = -90;
    
    const segments = [];
    for (let i = 0; i < data.length; i++) {
      const percentage = (data[i].amount / grandTotal) * 100;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);
      
      const largeArcFlag = angle > 180 ? 1 : 0;
      
      const pathData = `
        M ${center} ${center}
        L ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
        Z
      `;
      
      segments.push(
        <Path key={i} d={pathData} fill={data[i].color} stroke="#1a472a" strokeWidth="2" />
      );
      
      currentAngle = endAngle;
    }
    
    return (
      <View style={{ alignItems: 'center' }}>
        <Svg height={size} width={size} viewBox={`0 0 ${size} ${size}`}>
          {segments}
          <Circle cx={center} cy={center} r={holeRadius} fill="#1a472a" />
        </Svg>
        
        <View style={{ position: 'absolute', top: center - 25, left: 0, right: 0, alignItems: 'center' }}>
          <Text style={{ color: '#4ECDC4', fontSize: 11, fontFamily: 'Poppins-SemiBold' }}>
            Total
          </Text>
          <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold' }}>
            ₱{formatNumber(grandTotal)}
          </Text>
        </View>
      </View>
    );
  };

  const CategoryList = ({ data }: { data: any[] }) => {
    if (!data || data.length === 0) return null;
    
    const grandTotal = totalSpending;
    
    return (
      <View style={{ marginTop: 20, width: '100%' }}>
        {data.map((item, index) => {
          const percentage = ((item.amount / grandTotal) * 100).toFixed(1);
          return (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 12, height: 12, backgroundColor: item.color, marginRight: 12, borderRadius: 4 }} />
              <Text style={{ color: '#ffffff', flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13 }}>
                {item.name}
              </Text>
              <Text style={{ color: '#90ee90', fontFamily: 'Poppins-SemiBold', fontSize: 13, marginRight: 8 }}>
                ₱{formatNumber(item.amount)}
              </Text>
              <Text style={{ color: '#4ECDC4', fontFamily: 'Poppins-SemiBold', fontSize: 12 }}>
                {percentage}%
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const CustomDatePicker = () => {
    const daysInMonth = getDaysInMonth(selectedMonthPicker, selectedYearPicker);
    const firstDayOfMonth = new Date(selectedYearPicker, selectedMonthPicker, 1).getDay();
    const today = new Date();
    
    const isToday = (day: number) => {
      return today.getDate() === day && 
             today.getMonth() === selectedMonthPicker && 
             today.getFullYear() === selectedYearPicker;
    };

    const isSelectedDate = (day: number) => {
      return selectedDate.getDate() === day && 
             selectedDate.getMonth() === selectedMonthPicker && 
             selectedDate.getFullYear() === selectedYearPicker;
    };

    const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    return (
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
            padding: 20,
            maxHeight: '80%',
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              paddingBottom: 15,
              borderBottomWidth: 1,
              borderBottomColor: '#2a5a3a',
            }}>
              <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
                Select Month & Year
              </Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Icon name="x" size={24} color="#90ee90" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <View style={{ 
                flex: 1, 
                backgroundColor: '#1a3a2a', 
                borderRadius: 10, 
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#2a5a3a',
              }}>
                <Picker
                  selectedValue={selectedMonthPicker}
                  onValueChange={handleMonthChange}
                  dropdownIconColor="#90ee90"
                  style={{ color: '#ffffff', backgroundColor: '#1a3a2a', height: 50 }}
                  dropdownBackgroundColor="#1a3a2a"
                >
                  {months.map((month, index) => (
                    <Picker.Item 
                      key={index} 
                      label={month} 
                      value={index} 
                      color="#ffffff"
                      style={{ backgroundColor: '#1a3a2a', color: '#ffffff' }}
                    />
                  ))}
                </Picker>
              </View>
              <View style={{ 
                flex: 1, 
                backgroundColor: '#1a3a2a', 
                borderRadius: 10, 
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#2a5a3a',
              }}>
                <Picker
                  selectedValue={selectedYearPicker}
                  onValueChange={handleYearChange}
                  dropdownIconColor="#90ee90"
                  style={{ color: '#ffffff', backgroundColor: '#1a3a2a', height: 50 }}
                  dropdownBackgroundColor="#1a3a2a"
                >
                  {years.map((year) => (
                    <Picker.Item 
                      key={year} 
                      label={year.toString()} 
                      value={year} 
                      color="#ffffff"
                      style={{ backgroundColor: '#1a3a2a', color: '#ffffff' }}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 10, paddingHorizontal: 5 }}>
              {weekDays.map((day, index) => (
                <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: '#90ee90', fontSize: 11, fontFamily: 'Poppins-SemiBold' }}>
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                  <View key={`empty-${index}`} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 5 }}>
                    <View style={{ flex: 1 }} />
                  </View>
                ))}
                
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const isCurrentDay = isToday(day);
                  const isSelected = isSelectedDate(day);
                  
                  return (
                    <TouchableOpacity
                      key={day}
                      style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 5 }}
                      onPress={() => handleDateSelect(day)}
                    >
                      <View style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 25,
                        backgroundColor: isSelected ? '#90ee90' : 'transparent',
                        borderWidth: isCurrentDay && !isSelected ? 1 : 0,
                        borderColor: '#90ee90',
                      }}>
                        <Text style={{
                          color: isSelected ? '#1a472a' : '#ffffff',
                          fontSize: 16,
                          fontFamily: isSelected ? 'Poppins-Bold' : 'Poppins-Regular',
                        }}>
                          {day}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#2a5a3a',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#4a8a6a',
                }}
                onPress={() => {
                  const today = new Date();
                  setSelectedMonthPicker(today.getMonth());
                  setSelectedYearPicker(today.getFullYear());
                }}
              >
                <Text style={{ color: '#90ee90', fontFamily: 'Poppins-SemiBold' }}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#90ee90',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleApplyDate}
              >
                <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const StickyHeader = () => (
    <View style={{ padding: 20, paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 20 }}>
        <Text style={{ color: '#ffffff', fontSize: 28, fontFamily: 'Poppins-Bold' }}>
          Statistics
        </Text>
        <TouchableOpacity 
          onPress={() => {
            setSelectedMonthPicker(selectedDate.getMonth());
            setSelectedYearPicker(selectedDate.getFullYear());
            setShowDatePicker(true);
          }}
          style={{
            backgroundColor: '#2a5a3a',
            padding: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#4a8a6a'
          }}
        >
          <Icon name="calendar" size={22} color="#90ee90" />
        </TouchableOpacity>
      </View>

      <View style={{
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
      }}>
        <View style={{
          flex: 1,
          backgroundColor: '#2a5a3a',
          padding: 15,
          borderRadius: 12,
        }}>
          <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
            Expenses
          </Text>
          <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
            ₱{formatNumber(totalExpenses)}
          </Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: '#1a3a2a',
          padding: 15,
          borderRadius: 12,
        }}>
          <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
            Shopping
          </Text>
          <Text style={{ color: '#4ECDC4', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
            ₱{formatNumber(totalShopping)}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a472a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#90ee90" />
        <Text style={{ color: '#c0e0c0', marginTop: 10, fontFamily: 'Poppins-Regular' }}>
          {isOffline ? 'Using offline data...' : 'Loading statistics...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a472a' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1a472a" />
      
      <View style={{ flex: 1 }}>
        <StickyHeader />

        <FlatList
          data={[{ key: 'content' }]}
          renderItem={() => (
            <View style={{ paddingHorizontal: 20 }}>
              {/* Donut Chart */}
              <View style={{
                backgroundColor: '#2a5a3a',
                paddingVertical: 25,
                paddingHorizontal: 20,
                borderRadius: 20,
                marginBottom: 20,
                alignItems: 'center',
              }}>
                <View style={{ alignItems: 'center', marginBottom: 15 }}>
                  <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold', textAlign: 'center' }}>
                    Spending Distribution
                  </Text>
                  <View style={{ 
                    width: 50, 
                    height: 3, 
                    backgroundColor: '#4ECDC4', 
                    borderRadius: 2, 
                    marginTop: 8 
                  }} />
                </View>
                
                <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 20 }}>
                  {selectedMonth}
                </Text>
                
                {chartData.length === 0 && totalSpending === 0 ? (
                  <View style={{ alignItems: 'center', padding: 40 }}>
                    <Icon name="pie-chart" size={50} color="#90ee90" opacity={0.5} />
                    <Text style={{ color: '#c0e0c0', fontFamily: 'Poppins-Regular', marginTop: 10, textAlign: 'center' }}>
                      No data for this month
                    </Text>
                    {isOffline && (
                      <Text style={{ color: '#90ee90', fontSize: 11, fontFamily: 'Poppins-Regular', marginTop: 5 }}>
                        Connect to internet to sync data
                      </Text>
                    )}
                  </View>
                ) : (
                  <>
                    <DonutChartWithTotal data={chartData} size={220} />
                    <CategoryList data={chartData} />
                  </>
                )}
              </View>

              {/* Daily Spending */}
              <View style={{
                backgroundColor: '#2a5a3a',
                padding: 20,
                borderRadius: 20,
                marginBottom: 30,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 8 }}>
                  <Icon name="calendar" size={20} color="#4ECDC4" />
                  <Text style={{ color: '#90ee90', fontSize: 16, fontFamily: 'Poppins-SemiBold' }}>
                    Daily Spending
                  </Text>
                </View>
                
                {dailySpending.length > 0 ? (
                  dailySpending.map((day, index) => {
                    const maxAmount = Math.max(...dailySpending.map(d => d.amount), 1);
                    const percentage = (day.amount / maxAmount) * 100;
                    return (
                      <View key={index} style={{ marginBottom: 15 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                          <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular', fontSize: 13 }}>
                            Day {day.day} ({day.dayName})
                          </Text>
                          <Text style={{ color: '#4ECDC4', fontFamily: 'Poppins-SemiBold', fontSize: 13 }}>
                            ₱{formatNumber(day.amount)}
                          </Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: '#3a6a4a', borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{
                            height: '100%',
                            width: `${percentage}%`,
                            backgroundColor: '#4ECDC4',
                            borderRadius: 3,
                          }} />
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={{ alignItems: 'center', padding: 30 }}>
                    <Icon name="bar-chart-2" size={50} color="#90ee90" opacity={0.5} />
                    <Text style={{ color: '#c0e0c0', textAlign: 'center', fontFamily: 'Poppins-Regular', marginTop: 10 }}>
                      No spending data for {selectedMonth}
                    </Text>
                  </View>
                )}
              </View>

              {expenses.length === 0 && shoppingItems.filter(i => i.completed).length === 0 && (
                <View style={{
                  backgroundColor: '#2a5a3a',
                  padding: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  marginTop: 10,
                  marginBottom: 20
                }}>
                  <Icon name="credit-card" size={50} color="#90ee90" opacity={0.5} />
                  <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-SemiBold', marginTop: 15, textAlign: 'center' }}>
                    No Data Yet
                  </Text>
                  <Text style={{ color: '#c0e0c0', textAlign: 'center', fontFamily: 'Poppins-Regular', marginTop: 10 }}>
                    Add expenses or complete shopping items to see statistics.
                  </Text>
                </View>
              )}
            </View>
          )}
          keyExtractor={() => 'content'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#90ee90"
              colors={['#90ee90']}
            />
          }
        />
      </View>

      <CustomDatePicker />
    </SafeAreaView>
  );
}