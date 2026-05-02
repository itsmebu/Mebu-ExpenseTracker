// app/(tabs)/pending-expenses.tsx

import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, RefreshControl, SafeAreaView, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { addExpense } from '../../../store/expenses';
import { deletePendingExpense, getPendingExpenses, markAsPaid, PendingExpense, updatePendingExpense } from '../../../store/pendingExpenses';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', symbol: '₱' },
  { value: 'gcash', label: 'GCash', icon: 'phone' },
  { value: 'card', label: 'Card', icon: 'credit-card' },
];

const BILL_CATEGORIES = [
  'Electricity', 'Water', 'Internet', 'Rent/Mortgage',
  'Phone Bill', 'Gas', 'Insurance', 'Subscription', 'Other Bill'
];

const DEBT_CATEGORIES = [
  'Credit Card', 'Personal Loan', 'Bank Loan', 'Mortgage',
  'Medical Debt', 'Student Loan', 'Pay Later', 'Other Debt'
];

export default function PendingExpensesScreen() {
  const [pendingExpenses, setPendingExpenses] = useState<PendingExpense[]>([]);
  const [activeTab, setActiveTab] = useState<'bill' | 'debt'>('bill');
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');
  const [selectedExpense, setSelectedExpense] = useState<PendingExpense | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editSelectedMonth, setEditSelectedMonth] = useState(new Date().getMonth());
  const [editSelectedYear, setEditSelectedYear] = useState(new Date().getFullYear());
  const router = useRouter();

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
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

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const showAlert = (message: string, type: 'success' | 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlertModal(true);
    setTimeout(() => {
      setShowAlertModal(false);
    }, 2000);
  };

  const loadData = async () => {
    try {
      const expenses = await getPendingExpenses();
      const unpaidExpenses = expenses.filter(exp => !exp.isPaid);
      const expensesWithType = unpaidExpenses.map(exp => ({
        ...exp,
        type: exp.type || 'bill'
      }));
      setPendingExpenses(expensesWithType);
    } catch (error) {
      console.error('Load data error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleMarkAsPaid = async () => {
    if (!selectedExpense) return;
    
    setLoading(true);
    
    const markResult = await markAsPaid(selectedExpense.id!, selectedPaymentMethod);
    
    if (markResult.success) {
      const expenseData = {
        name: selectedExpense.title,
        amount: selectedExpense.amount,
        category: selectedExpense.category,
        paymentMethod: selectedPaymentMethod,
        date: new Date(),
        note: `Paid ${selectedExpense.type === 'bill' ? 'bill' : 'debt'}: ${selectedExpense.description || ''}`
      };
      
      await addExpense(expenseData);
      
      setShowPaymentModal(false);
      setSelectedExpense(null);
      setSelectedPaymentMethod('cash');
      await loadData();
      showAlert(`${selectedExpense.type === 'bill' ? 'Bill' : 'Debt'} marked as paid!`, 'success');
    } else {
      showAlert('Failed to mark as paid', 'error');
    }
    
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;
    
    const result = await deletePendingExpense(selectedExpense.id!);
    if (result.success) {
      setShowDeleteModal(false);
      setSelectedExpense(null);
      await loadData();
      showAlert(`${selectedExpense.type === 'bill' ? 'Bill' : 'Debt'} deleted successfully`, 'success');
    } else {
      showAlert('Failed to delete', 'error');
    }
  };

  const handleEdit = async () => {
    if (!selectedExpense) return;
    
    if (!editTitle.trim()) {
      showAlert('Please enter a title', 'error');
      return;
    }
    
    const editAmountNum = parseFloat(editAmount);
    if (isNaN(editAmountNum) || editAmountNum <= 0) {
      showAlert('Please enter a valid amount', 'error');
      return;
    }
    
    setLoading(true);
    
    const result = await updatePendingExpense(selectedExpense.id!, {
      title: editTitle.trim(),
      amount: editAmountNum,
      category: editCategory,
      description: editDescription.trim(),
      dueDate: editDueDate,
    });
    
    if (result.success) {
      setShowEditModal(false);
      setSelectedExpense(null);
      await loadData();
      showAlert('Updated successfully', 'success');
    } else {
      showAlert('Failed to update', 'error');
    }
    
    setLoading(false);
  };

  const openEditModal = (item: PendingExpense) => {
    setSelectedExpense(item);
    setEditTitle(item.title);
    setEditAmount(item.amount.toString());
    setEditCategory(item.category);
    setEditDescription(item.description || '');
    setEditDueDate(item.dueDate);
    setEditSelectedMonth(item.dueDate.getMonth());
    setEditSelectedYear(item.dueDate.getFullYear());
    setShowEditModal(true);
  };

  const handleEditDateSelect = (day: number) => {
    const newDate = new Date(editSelectedYear, editSelectedMonth, day);
    setEditDueDate(newDate);
    setShowEditDatePicker(false);
  };

  const getDueDateColor = (dueDate: Date) => {
    const daysUntil = getDaysUntilDue(dueDate);
    if (daysUntil < 0) return '#ff6b6b';
    if (daysUntil <= 3) return '#FFA500';
    return '#90ee90';
  };

  const getDueDateText = (dueDate: Date) => {
    const daysUntil = getDaysUntilDue(dueDate);
    if (daysUntil < 0) return `Overdue by ${Math.abs(daysUntil)} days`;
    if (daysUntil === 0) return 'Due today';
    if (daysUntil === 1) return 'Due tomorrow';
    return `Due in ${daysUntil} days`;
  };

  const getCurrentCategories = () => {
    return activeTab === 'bill' ? BILL_CATEGORIES : DEBT_CATEGORIES;
  };

  const EditDatePicker = () => {
    const daysInMonth = getDaysInMonth(editSelectedMonth, editSelectedYear);
    const firstDayOfMonth = new Date(editSelectedYear, editSelectedMonth, 1).getDay();
    const today = new Date();
    
    const isToday = (day: number) => {
      return today.getDate() === day && 
             today.getMonth() === editSelectedMonth && 
             today.getFullYear() === editSelectedYear;
    };

    const isSelectedDate = (day: number) => {
      return editDueDate.getDate() === day && 
             editDueDate.getMonth() === editSelectedMonth && 
             editDueDate.getFullYear() === editSelectedYear;
    };

    const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    return (
      <Modal
        visible={showEditDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditDatePicker(false)}
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
                Select Due Date
              </Text>
              <TouchableOpacity onPress={() => setShowEditDatePicker(false)}>
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
                  selectedValue={editSelectedMonth}
                  onValueChange={(itemValue) => setEditSelectedMonth(itemValue)}
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
                  selectedValue={editSelectedYear}
                  onValueChange={(itemValue) => setEditSelectedYear(itemValue)}
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

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={true}>
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
                      onPress={() => handleEditDateSelect(day)}
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

            <TouchableOpacity
              style={{
                backgroundColor: '#2a5a3a',
                padding: 12,
                borderRadius: 10,
                alignItems: 'center',
                marginTop: 15,
                borderWidth: 1,
                borderColor: '#4a8a6a',
              }}
              onPress={() => {
                const today = new Date();
                setEditSelectedMonth(today.getMonth());
                setEditSelectedYear(today.getFullYear());
                setEditDueDate(today);
                setShowEditDatePicker(false);
              }}
            >
              <Text style={{ color: '#90ee90', fontFamily: 'Poppins-SemiBold' }}>Select Today</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderItem = ({ item }: { item: PendingExpense }) => {
    const dueDateColor = getDueDateColor(item.dueDate);
    const dueDateText = getDueDateText(item.dueDate);
    const isBill = item.type === 'bill';
    
    return (
      <View style={{
        backgroundColor: '#2a5a3a',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon 
                name={isBill ? 'file-text' : 'credit-card'} 
                size={14} 
                color={isBill ? '#4ECDC4' : '#FF6B6B'} 
              />
              <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Poppins-SemiBold' }}>
                {item.title}
              </Text>
            </View>
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular', marginTop: 2 }}>
              {item.category}
            </Text>
          </View>
          <Text style={{ color: '#FFEAA7', fontSize: 18, fontFamily: 'Poppins-Bold' }}>
            ₱{formatNumber(item.amount)}
          </Text>
        </View>
        
        {item.description ? (
          <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 8 }}>
            {item.description}
          </Text>
        ) : null}
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="calendar" size={14} color={dueDateColor} />
            <Text style={{ color: dueDateColor, fontSize: 12, fontFamily: 'Poppins-Regular' }}>
              {formatDate(item.dueDate)} • {dueDateText}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity 
              onPress={() => {
                setSelectedExpense(item);
                setShowPaymentModal(true);
              }}
              style={{
                backgroundColor: '#4ECDC4',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: '#1a472a', fontSize: 12, fontFamily: 'Poppins-SemiBold' }}>
                Mark Paid
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => openEditModal(item)}
              style={{
                backgroundColor: '#90ee90',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
              }}
            >
              <Icon name="edit-2" size={16} color="#1a472a" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => {
                setSelectedExpense(item);
                setShowDeleteModal(true);
              }}
            >
              <Icon name="trash-2" size={20} color="#ff6b6b" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const filteredExpenses = pendingExpenses.filter(item => item.type === activeTab);
  const totalPending = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const overdueCount = filteredExpenses.filter(item => getDaysUntilDue(item.dueDate) < 0).length;
  const billsCount = pendingExpenses.filter(item => item.type === 'bill').length;
  const debtsCount = pendingExpenses.filter(item => item.type === 'debt').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a472a' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1a472a" />
      
      <View style={{ paddingHorizontal: 20, paddingTop: 40 }}>
        {/* Header with Title and Add Button */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ color: '#ffffff', fontSize: 28, fontFamily: 'Poppins-Bold' }}>
            Pending
          </Text>
          
          {/* Add Button */}
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/add-pending-expense')}
            style={{
              backgroundColor: '#90ee90',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon name="plus" size={20} color="#1a472a" />
            <Text style={{ color: '#1a472a', fontSize: 14, fontFamily: 'Poppins-SemiBold' }}>
              Add
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab Selector */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => setActiveTab('bill')}
            style={{
              flex: 1,
              backgroundColor: activeTab === 'bill' ? '#2a5a3a' : '#1a3a2a',
              padding: 12,
              borderRadius: 10,
              alignItems: 'center',
              borderWidth: activeTab === 'bill' ? 1 : 0,
              borderColor: '#4ECDC4',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon name="file-text" size={18} color="#4ECDC4" />
            <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: 'Poppins-SemiBold' }}>
              Bills ({billsCount})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setActiveTab('debt')}
            style={{
              flex: 1,
              backgroundColor: activeTab === 'debt' ? '#2a5a3a' : '#1a3a2a',
              padding: 12,
              borderRadius: 10,
              alignItems: 'center',
              borderWidth: activeTab === 'debt' ? 1 : 0,
              borderColor: '#FF6B6B',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon name="credit-card" size={18} color="#FF6B6B" />
            <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: 'Poppins-SemiBold' }}>
              Debts ({debtsCount})
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Total Pending Card */}
        <View style={{
          backgroundColor: '#2a5a3a',
          padding: 15,
          borderRadius: 12,
          marginBottom: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <View>
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
              Total {activeTab === 'bill' ? 'Bills' : 'Debts'}
            </Text>
            <Text style={{ color: '#FFEAA7', fontSize: 24, fontFamily: 'Poppins-Bold' }}>
              ₱{formatNumber(totalPending)}
            </Text>
          </View>
          {overdueCount > 0 && (
            <View style={{ backgroundColor: '#ff6b6b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
              <Text style={{ color: '#ffffff', fontSize: 12, fontFamily: 'Poppins-SemiBold' }}>
                {overdueCount} Overdue
              </Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={filteredExpenses}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
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
          <View style={{ alignItems: 'center', padding: 60 }}>
            <Icon 
              name={activeTab === 'bill' ? 'file-text' : 'credit-card'} 
              size={60} 
              color={activeTab === 'bill' ? '#4ECDC4' : '#FF6B6B'} 
              opacity={0.5} 
            />
            <Text style={{ color: '#c0e0c0', textAlign: 'center', fontFamily: 'Poppins-Regular', marginTop: 15, fontSize: 16 }}>
              No pending {activeTab === 'bill' ? 'bills' : 'debts'}
            </Text>
            <Text style={{ color: '#90ee90', textAlign: 'center', fontFamily: 'Poppins-Regular', marginTop: 5, fontSize: 12 }}>
              Tap the Add button above to get started
            </Text>
          </View>
        }
      />

      {/* Edit Modal - Dark Green Theme */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
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
            padding: 24,
            borderRadius: 20,
            width: '90%',
            maxWidth: 360,
            borderWidth: 1,
            borderColor: '#2a5a3a',
          }}>
            <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold', textAlign: 'center', marginBottom: 20 }}>
              Edit {selectedExpense?.type === 'bill' ? 'Bill' : 'Debt'}
            </Text>
            
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 5 }}>
              Title *
            </Text>
            <TextInput
              style={{
                backgroundColor: '#2a5a3a',
                padding: 12,
                borderRadius: 10,
                color: '#ffffff',
                marginBottom: 15,
                fontFamily: 'Poppins-Regular',
              }}
              placeholder="Title"
              placeholderTextColor="#90ee90"
              value={editTitle}
              onChangeText={setEditTitle}
            />
            
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 5 }}>
              Amount *
            </Text>
            <TextInput
              style={{
                backgroundColor: '#2a5a3a',
                padding: 12,
                borderRadius: 10,
                color: '#ffffff',
                marginBottom: 15,
                fontFamily: 'Poppins-Regular',
              }}
              placeholder="0.00"
              placeholderTextColor="#90ee90"
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
            />
            
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 5 }}>
              Category *
            </Text>
            <View style={{ 
              backgroundColor: '#1a3a2a', 
              borderRadius: 10, 
              marginBottom: 15, 
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: '#2a5a3a'
            }}>
              <Picker
                selectedValue={editCategory}
                onValueChange={(itemValue) => setEditCategory(itemValue)}
                dropdownIconColor="#90ee90"
                style={{ color: '#ffffff', backgroundColor: '#1a3a2a', height: 50 }}
                dropdownBackgroundColor="#1a3a2a"
              >
                {getCurrentCategories().map((cat) => (
                  <Picker.Item 
                    key={cat} 
                    label={cat} 
                    value={cat} 
                    color="#ffffff"
                    style={{ backgroundColor: '#1a3a2a', color: '#ffffff' }}
                  />
                ))}
              </Picker>
            </View>
            
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 5 }}>
              Due Date *
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#2a5a3a',
                padding: 12,
                borderRadius: 10,
                marginBottom: 15,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#4a8a6a',
              }}
              onPress={() => setShowEditDatePicker(true)}
            >
              <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>
                {editDueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
              <Icon name="calendar" size={20} color="#90ee90" />
            </TouchableOpacity>
            
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 5 }}>
              Description (Optional)
            </Text>
            <TextInput
              style={{
                backgroundColor: '#2a5a3a',
                padding: 12,
                borderRadius: 10,
                color: '#ffffff',
                marginBottom: 20,
                fontFamily: 'Poppins-Regular',
                height: 80,
                textAlignVertical: 'top'
              }}
              placeholder="Add description..."
              placeholderTextColor="#90ee90"
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
            />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
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
                onPress={() => setShowEditModal(false)}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#90ee90',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleEdit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1a472a" />
                ) : (
                  <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Method Modal - Dark Green Theme */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPaymentModal(false)}
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
            padding: 24,
            borderRadius: 20,
            width: '85%',
            maxWidth: 320,
            borderWidth: 1,
            borderColor: '#2a5a3a',
          }}>
            <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold', textAlign: 'center', marginBottom: 20 }}>
              Mark as Paid
            </Text>
            
            <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-Regular', marginBottom: 10 }}>
              Payment Method
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={{
                    flex: 1,
                    backgroundColor: selectedPaymentMethod === method.value ? '#3a6a4a' : '#2a5a3a',
                    padding: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    borderWidth: selectedPaymentMethod === method.value ? 1 : 0,
                    borderColor: '#90ee90',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onPress={() => setSelectedPaymentMethod(method.value)}
                >
                  {method.icon ? (
                    <Icon name={method.icon} size={16} color="#90ee90" />
                  ) : (
                    <Text style={{ color: '#90ee90', fontSize: 16, fontFamily: 'Poppins-Bold' }}>{method.symbol}</Text>
                  )}
                  <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular', fontSize: 12 }}>
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
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
                onPress={() => {
                  setShowPaymentModal(false);
                  setSelectedExpense(null);
                }}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#4ECDC4',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleMarkAsPaid}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1a472a" />
                ) : (
                  <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal - Dark Green Theme */}
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
            padding: 24,
            borderRadius: 20,
            width: '85%',
            maxWidth: 280,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#2a5a3a',
          }}>
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: '#3a1a1a',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <Icon name="alert-triangle" size={30} color="#ff6b6b" />
            </View>
            
            <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: 'Poppins-Bold', textAlign: 'center', marginBottom: 8 }}>
              Delete {selectedExpense?.type === 'bill' ? 'Bill' : 'Debt'}
            </Text>
            
            <Text style={{ color: '#c0e0c0', fontSize: 13, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 20 }}>
              Are you sure you want to delete "{selectedExpense?.title}"?
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
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#ff6b6b',
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleDelete}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-SemiBold' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Alert Modal - Success/Error Dark Green Theme */}
      <Modal
        visible={showAlertModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAlertModal(false)}
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
            padding: 24,
            borderRadius: 20,
            width: '85%',
            maxWidth: 280,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#2a5a3a',
          }}>
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: alertType === 'success' ? '#1a3a2a' : '#3a1a1a',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <Icon 
                name={alertType === 'success' ? 'check' : 'alert-triangle'} 
                size={30} 
                color={alertType === 'success' ? '#4ECDC4' : '#ff6b6b'} 
              />
            </View>
            
            <Text style={{ 
              color: alertType === 'success' ? '#4ECDC4' : '#ff6b6b', 
              fontSize: 20, 
              fontFamily: 'Poppins-Bold', 
              textAlign: 'center', 
              marginBottom: 8 
            }}>
              {alertType === 'success' ? 'Success!' : 'Error'}
            </Text>
            
            <Text style={{ 
              color: '#c0e0c0', 
              fontSize: 13, 
              fontFamily: 'Poppins-Regular', 
              textAlign: 'center' 
            }}>
              {alertMessage}
            </Text>
          </View>
        </View>
      </Modal>

      <EditDatePicker />
    </SafeAreaView>
  );
}