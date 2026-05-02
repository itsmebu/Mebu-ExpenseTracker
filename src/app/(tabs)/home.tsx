import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, Modal, RefreshControl, SafeAreaView, StatusBar, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { deleteExpense, Expense, getExpenses } from '../../../store/expenses';
import { getPendingExpenses, PendingExpense } from '../../../store/pendingExpenses';
import { deleteShoppingItem, getShoppingItems, ShoppingItem } from '../../../store/shoppingList';
import { useAuth } from '../../hooks/useAuth';

const { height } = Dimensions.get('window');

interface CombinedItem {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: Date;
  note?: string;
  paymentMethod?: string;
  type: 'expense' | 'shopping';
  timestamp: number;
}

interface DueBill {
  id: string;
  title: string;
  amount: number;
  dueDate: Date;
  category: string;
  daysUntilDue: number;
}

export default function HomeScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [combinedItems, setCombinedItems] = useState<CombinedItem[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<PendingExpense[]>([]);
  const [dueBills, setDueBills] = useState<DueBill[]>([]);
  const [totalPendingAmount, setTotalPendingAmount] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalShopping, setTotalShopping] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [todayExpense, setTodayExpense] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'expense' | 'shopping' } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const router = useRouter();
  const { user, userProfile, refreshUserProfile } = useAuth();
  const insets = useSafeAreaInsets();

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Format date
  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get payment method display
  const getPaymentDisplay = (method: string) => {
    switch(method) {
      case 'cash': return { icon: null, label: 'Cash', symbol: '₱', bgColor: '#3a6a4a' };
      case 'gcash': return { icon: 'phone', label: 'GCash', symbol: null, bgColor: '#2a5a3a' };
      case 'card': return { icon: 'credit-card', label: 'Card', symbol: null, bgColor: '#2a5a3a' };
      default: return { icon: null, label: 'Cash', symbol: '₱', bgColor: '#3a6a4a' };
    }
  };

  const getDaysUntilDue = (dueDate: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const loadDueBills = async () => {
    try {
      const expenses = await getPendingExpenses();
      const unpaidExpenses = expenses.filter(exp => !exp.isPaid);
      
      // Calculate total pending amount
      const totalPending = unpaidExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      setTotalPendingAmount(totalPending);
      
      const billsWithDueDates = unpaidExpenses.map(exp => ({
        id: exp.id!,
        title: exp.title,
        amount: exp.amount,
        dueDate: exp.dueDate,
        category: exp.category,
        daysUntilDue: getDaysUntilDue(exp.dueDate)
      }));
      
      // Filter bills that are due within 7 days or overdue
      const upcomingBills = billsWithDueDates.filter(bill => bill.daysUntilDue <= 7);
      setDueBills(upcomingBills);
    } catch (error) {
      console.error('Error loading due bills:', error);
    }
  };

  const loadData = async () => {
    try {
      const [allExpenses, allShoppingItems] = await Promise.all([
        getExpenses(),
        getShoppingItems()
      ]);
      
      setExpenses(allExpenses);
      setShoppingItems(allShoppingItems);
      
      const expensesTotal = allExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const shoppingTotal = allShoppingItems
        .filter(item => item.completed)
        .reduce((sum, item) => sum + item.price, 0);
      
      setTotalExpense(expensesTotal);
      setTotalShopping(shoppingTotal);
      
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyExpenses = allExpenses
        .filter(exp => exp.date.getMonth() === currentMonth && exp.date.getFullYear() === currentYear)
        .reduce((sum, exp) => sum + exp.amount, 0);
      const monthlyShopping = allShoppingItems
        .filter(item => {
          if (!item.completed) return false;
          const purchaseDate = item.completedAt || item.createdAt;
          return purchaseDate.getMonth() === currentMonth && purchaseDate.getFullYear() === currentYear;
        })
        .reduce((sum, item) => sum + item.price, 0);
      setMonthlyExpense(monthlyExpenses + monthlyShopping);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayExpenses = allExpenses.filter(exp => {
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate.getTime() === today.getTime();
      });
      const todayExpensesTotal = todayExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const todayShopping = allShoppingItems
        .filter(item => {
          if (!item.completed) return false;
          const purchaseDate = item.completedAt || item.createdAt;
          purchaseDate.setHours(0, 0, 0, 0);
          return purchaseDate.getTime() === today.getTime();
        })
        .reduce((sum, item) => sum + item.price, 0);
      setTodayExpense(todayExpensesTotal + todayShopping);
      
      // Combine expenses - USE THE EXPENSE NAME, NOT THE CATEGORY
      const expensesCombined: CombinedItem[] = allExpenses.map(exp => ({
        id: exp.id!,
        name: exp.name || 'Unnamed Expense',
        amount: exp.amount,
        category: exp.category,
        date: exp.date,
        note: exp.note,
        paymentMethod: exp.paymentMethod || 'cash',
        type: 'expense',
        timestamp: exp.date.getTime()
      }));
      
      // Combine shopping items
      const shoppingCombined: CombinedItem[] = allShoppingItems
        .filter(item => item.completed === true)
        .map(item => {
          const purchaseDate = item.completedAt || item.createdAt;
          return {
            id: item.id!,
            name: item.name,
            amount: item.price,
            category: item.category || 'Shopping',
            date: purchaseDate,
            note: `Price: ₱${formatNumber(item.price)}`,
            paymentMethod: item.paymentMethod || 'cash',
            type: 'shopping' as const,
            timestamp: purchaseDate.getTime()
          };
        });
      
      const combined = [...expensesCombined, ...shoppingCombined].sort((a, b) => b.timestamp - a.timestamp);
      setCombinedItems(combined);
      
      await loadDueBills();
      
    } catch (error) {
      console.error('Error loading data:', error);
      showModalMessage('Failed to load data', true);
    }
  };

  const showModalMessage = (message: string, error: boolean = false) => {
    setSuccessMessage(message);
    setIsError(error);
    setShowSuccessModal(true);
    setTimeout(() => {
      setShowSuccessModal(false);
    }, 2000);
  };

  const loadUserProfile = async () => {
    if (refreshUserProfile) {
      await refreshUserProfile();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadUserProfile()]);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadUserProfile();
    }, [])
  );

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    
    let result;
    if (itemToDelete.type === 'expense') {
      result = await deleteExpense(itemToDelete.id);
    } else {
      result = await deleteShoppingItem(itemToDelete.id);
    }
    
    setShowDeleteModal(false);
    setItemToDelete(null);
    
    if (result.success) {
      await loadData();
      showModalMessage(`${itemToDelete.type === 'expense' ? 'Expense' : 'Shopping item'} deleted successfully`);
    } else {
      showModalMessage(result.error || 'Failed to delete item', true);
    }
  };

  const openDeleteModal = (id: string, type: 'expense' | 'shopping') => {
    setItemToDelete({ id, type });
    setShowDeleteModal(true);
  };

  const toggleNotificationDropdown = () => {
    if (showNotificationDropdown) {
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowNotificationDropdown(false));
    } else {
      setShowNotificationDropdown(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const getCategoryIcon = (category: string) => {
    switch(category.toLowerCase()) {
      case 'food': return 'coffee';
      case 'transport': return 'truck';
      case 'transportation': return 'truck';
      case 'shopping': return 'shopping-bag';
      case 'bills': return 'file-text';
      case 'electricity': return 'zap';
      case 'water': return 'droplet';
      case 'internet': return 'wifi';
      case 'rent/mortgage': return 'home';
      case 'phone bill': return 'phone';
      case 'gas': return 'fuel';
      case 'insurance': return 'shield';
      case 'loan payment': return 'credit-card';
      case 'subscription': return 'repeat';
      case 'entertainment': return 'film';
      case 'health': return 'heart';
      case 'education': return 'book';
      case 'travel': return 'map-pin';
      case 'other': return 'tag';
      default: return 'tag';
    }
  };

  const getDueDateColor = (daysUntilDue: number) => {
    if (daysUntilDue < 0) return '#ff6b6b';
    if (daysUntilDue === 0) return '#FFA500';
    if (daysUntilDue <= 3) return '#FFA500';
    return '#90ee90';
  };

  const getDueDateText = (daysUntilDue: number) => {
    if (daysUntilDue < 0) return `Overdue by ${Math.abs(daysUntilDue)} days`;
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Due tomorrow';
    return `Due in ${daysUntilDue} days`;
  };

  const renderRecentItem = ({ item }: { item: CombinedItem }) => {
    const paymentDisplay = getPaymentDisplay(item.paymentMethod || 'cash');
    const isExpense = item.type === 'expense';
    const isShopping = item.type === 'shopping';
    
    return (
      <View style={{
        backgroundColor: isShopping ? '#1a3a2a' : '#2a5a3a',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
            <Icon name={getCategoryIcon(item.category)} size={12} color="#90ee90" />
            <Text style={{ color: '#90ee90', fontSize: 10, fontFamily: 'Poppins-Regular' }}>
              {item.category}
            </Text>
            {isShopping && (
              <View style={{ backgroundColor: '#4ECDC4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: '#1a472a', fontSize: 8, fontFamily: 'Poppins-SemiBold' }}>Shopping</Text>
              </View>
            )}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 4, 
              backgroundColor: paymentDisplay.bgColor,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              borderWidth: 0.5,
              borderColor: '#4a8a6a',
            }}>
              {paymentDisplay.icon ? (
                <Icon name={paymentDisplay.icon} size={10} color="#90ee90" />
              ) : (
                <Text style={{ color: '#90ee90', fontSize: 10, fontFamily: 'Poppins-Bold' }}>{paymentDisplay.symbol}</Text>
              )}
              <Text style={{ color: '#90ee90', fontSize: 8, fontFamily: 'Poppins-Regular' }}>
                {paymentDisplay.label}
              </Text>
            </View>
          </View>
          
          <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Poppins-SemiBold', marginBottom: 4 }}>
            {item.name}
          </Text>
          
          <Text style={{ 
            color: isShopping ? '#4ECDC4' : '#FFEAA7', 
            fontSize: 18, 
            fontFamily: 'Poppins-Bold',
            marginBottom: 4
          }}>
            ₱{formatNumber(item.amount)}
          </Text>
          
          <Text style={{ color: '#c0e0c0', fontSize: 10, fontFamily: 'Poppins-Regular' }}>
            {formatDateTime(item.date)}
          </Text>
          
          {item.note && !isShopping && (
            <Text style={{ color: '#90ee90', fontSize: 11, fontFamily: 'Poppins-Regular', marginTop: 4 }}>
              Note: {item.note}
            </Text>
          )}
        </View>
        
        <TouchableOpacity onPress={() => openDeleteModal(item.id, item.type)}>
          <Icon name="trash-2" size={20} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderNotificationItem = ({ item }: { item: DueBill }) => {
    const dueDateColor = getDueDateColor(item.daysUntilDue);
    const dueDateText = getDueDateText(item.daysUntilDue);
    
    return (
      <TouchableOpacity
        onPress={() => {
          toggleNotificationDropdown();
          router.push('/(tabs)/pending-expenses');
        }}
        style={{
          backgroundColor: '#2a5a3a',
          padding: 12,
          marginBottom: 8,
          borderRadius: 10,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#1a3a2a',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}>
          <Icon name={getCategoryIcon(item.category)} size={20} color="#90ee90" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: 'Poppins-SemiBold' }}>
            {item.title}
          </Text>
          <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
            ₱{formatNumber(item.amount)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
            <Icon name="calendar" size={10} color={dueDateColor} />
            <Text style={{ color: dueDateColor, fontSize: 10, fontFamily: 'Poppins-Regular' }}>
              {dueDateText}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={18} color="#90ee90" />
      </TouchableOpacity>
    );
  };

  const getDisplayName = () => {
    if (userProfile?.username) {
      return userProfile.username;
    }
    if (userProfile?.fullName) {
      return userProfile.fullName;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  const recentItems = combinedItems.slice(0, 5);
  const hasNotifications = dueBills.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a472a' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1a472a" />
      
      <View style={{ flex: 1 }}>
        {/* Sticky Header Section - Does NOT scroll */}
        <View style={{ paddingHorizontal: 20, paddingTop: 40 }}>
          {/* Welcome Header with Logo, Username and Notification Bell */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image 
                source={require('../../../assets/images/logo.png')} 
                style={{ width: 50, height: 50, resizeMode: 'contain', marginRight: 12 }} 
              />
              <View>
                <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-Regular' }}>
                  Welcome back,
                </Text>
                <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
                  @{getDisplayName()}!
                </Text>
              </View>
            </View>
            
            {/* Notification Bell */}
            <TouchableOpacity 
              onPress={toggleNotificationDropdown}
              style={{ position: 'relative' }}
            >
              <Icon name="bell" size={24} color="#90ee90" />
              {hasNotifications && (
                <View style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  backgroundColor: '#ff6b6b',
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{ color: '#ffffff', fontSize: 10, fontFamily: 'Poppins-Bold' }}>
                    {dueBills.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* 2x2 Grid Cards */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            {/* Card 1: This Month */}
            <View style={{
              flex: 1,
              minWidth: '47%',
              backgroundColor: '#2a5a3a',
              padding: 15,
              borderRadius: 12,
            }}>
              <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
                This Month
              </Text>
              <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold', marginTop: 4 }}>
                ₱{formatNumber(monthlyExpense)}
              </Text>
            </View>

            {/* Card 2: Today */}
            <View style={{
              flex: 1,
              minWidth: '47%',
              backgroundColor: '#2a5a3a',
              padding: 15,
              borderRadius: 12,
            }}>
              <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
                Today
              </Text>
              <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold', marginTop: 4 }}>
                ₱{formatNumber(todayExpense)}
              </Text>
            </View>

            {/* Card 3: Shopping Total */}
            <View style={{
              flex: 1,
              minWidth: '47%',
              backgroundColor: '#1a3a2a',
              padding: 15,
              borderRadius: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon name="shopping-bag" size={16} color="#4ECDC4" />
                <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
                  Shopping Total
                </Text>
              </View>
              <Text style={{ color: '#4ECDC4', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
                ₱{formatNumber(totalShopping)}
              </Text>
            </View>

            {/* Card 4: Pending Payments - Dark Green Theme */}
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/pending-expenses')}
              style={{
                flex: 1,
                minWidth: '47%',
                backgroundColor: totalPendingAmount > 0 ? '#2a5a3a' : '#1a3a2a',
                padding: 15,
                borderRadius: 12,
                borderWidth: totalPendingAmount > 0 ? 1 : 0,
                borderColor: '#4ECDC4',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon name="alert-circle" size={16} color={totalPendingAmount > 0 ? '#4ECDC4' : '#90ee90'} />
                <Text style={{ color: totalPendingAmount > 0 ? '#4ECDC4' : '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
                  Pending Payments
                </Text>
              </View>
              <Text style={{ color: totalPendingAmount > 0 ? '#4ECDC4' : '#90ee90', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
                ₱{formatNumber(totalPendingAmount)}
              </Text>
              {totalPendingAmount > 0 && (
                <Text style={{ color: '#4ECDC4', fontSize: 10, fontFamily: 'Poppins-Regular', marginTop: 4 }}>
                  {dueBills.length} bill{dueBills.length !== 1 ? 's' : ''} due soon
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Total Spending Card - With Highlighted Border */}
          <View style={{
            backgroundColor: '#2a5a3a',
            padding: 15,
            borderRadius: 12,
            marginBottom: 20,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#90ee90',
            shadowColor: '#90ee90',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
            elevation: 5,
          }}>
            <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold' }}>
              Total Spending
            </Text>
            <Text style={{ color: '#ffffff', fontSize: 24, fontFamily: 'Poppins-Bold' }}>
              ₱{formatNumber(totalExpense + totalShopping)}
            </Text>
          </View>

          {/* Recent Activity Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-SemiBold' }}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/recent-activity')}>
              <Text style={{ color: '#90ee90', fontFamily: 'Poppins-Regular' }}>View All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Recent Activity List - ONLY THIS SCROLLS */}
        <FlatList
          data={recentItems}
          renderItem={renderRecentItem}
          keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#90ee90"
              colors={['#90ee90']}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: 40, minHeight: height * 0.3 }}>
              <Icon name="inbox" size={50} color="#90ee90" />
              <Text style={{ color: '#c0e0c0', textAlign: 'center', fontFamily: 'Poppins-Regular', marginTop: 10 }}>
                No activity yet. Add expenses or complete shopping items to get started.
              </Text>
            </View>
          }
        />
      </View>

      {/* Notification Dropdown */}
      {showNotificationDropdown && (
        <TouchableWithoutFeedback onPress={toggleNotificationDropdown}>
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 998,
          }}>
            <TouchableWithoutFeedback>
              <Animated.View style={{
                position: 'absolute',
                top: 100,
                right: 20,
                left: 20,
                backgroundColor: '#1a472a',
                borderRadius: 15,
                padding: 16,
                maxHeight: 400,
                zIndex: 999,
                borderWidth: 1,
                borderColor: '#2a5a3a',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 5,
                elevation: 8,
                transform: [{ translateY: slideAnim }],
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                  <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold' }}>
                    Upcoming Bills
                  </Text>
                  <TouchableOpacity onPress={toggleNotificationDropdown}>
                    <Icon name="x" size={22} color="#90ee90" />
                  </TouchableOpacity>
                </View>
                
                {dueBills.length > 0 ? (
                  <FlatList
                    data={dueBills}
                    renderItem={renderNotificationItem}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ paddingBottom: 10 }}
                  />
                ) : (
                  <View style={{ alignItems: 'center', padding: 40 }}>
                    <Icon name="bell-off" size={40} color="#90ee90" opacity={0.5} />
                    <Text style={{ color: '#c0e0c0', textAlign: 'center', fontFamily: 'Poppins-Regular', marginTop: 10 }}>
                      No upcoming bills due within 7 days
                    </Text>
                  </View>
                )}
                
                {dueBills.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      toggleNotificationDropdown();
                      router.push('/(tabs)/pending-expenses');
                    }}
                    style={{
                      marginTop: 15,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: '#2a5a3a',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-SemiBold' }}>
                      View All Pending Bills
                    </Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 25,
            borderRadius: 16,
            width: '85%',
            maxWidth: 300,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#4a8a6a',
          }}>
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: '#3a1a1a',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 15,
            }}>
              <Icon name="alert-triangle" size={30} color="#ff6b6b" />
            </View>
            
            <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold', marginBottom: 8, textAlign: 'center' }}>
              Delete {itemToDelete?.type === 'shopping' ? 'Item' : 'Expense'}
            </Text>
            
            <Text style={{ color: '#c0e0c0', fontSize: 14, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 20 }}>
              Are you sure you want to delete this {itemToDelete?.type}? This action cannot be undone.
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#3a6a4a',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#4a8a6a',
                }}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#ff6b6b',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleDeleteItem}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-SemiBold', fontSize: 14 }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success/Error Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#1a472a',
            padding: 20,
            borderRadius: 16,
            width: '85%',
            maxWidth: 280,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#4a8a6a',
          }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: isError ? '#3a1a1a' : '#4ECDC4',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <Icon 
                name={isError ? 'alert-triangle' : 'check'} 
                size={28} 
                color={isError ? '#ff6b6b' : '#1a472a'} 
              />
            </View>
            
            <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold', marginBottom: 6, textAlign: 'center' }}>
              {isError ? 'Error' : 'Success!'}
            </Text>
            
            <Text style={{ color: '#c0e0c0', fontSize: 13, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 15 }}>
              {successMessage}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}