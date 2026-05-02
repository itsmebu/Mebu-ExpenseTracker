// app/(tabs)/add-pending-expense.tsx

import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, RefreshControl, SafeAreaView, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { addPendingExpense } from '../../../store/pendingExpenses';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BILL_CATEGORIES = [
  'Electricity', 'Water', 'Internet', 'Rent/Mortgage',
  'Phone Bill', 'Gas', 'Insurance', 'Subscription', 'Other Bill'
];

const DEBT_CATEGORIES = [
  'Credit Card', 'Personal Loan', 'Bank Loan', 'Mortgage',
  'Medical Debt', 'Student Loan', 'Pay Later', 'Other Debt'
];

const TYPE_OPTIONS = [
  { value: 'bill', label: 'Bill', icon: 'file-text', color: '#4ECDC4' },
  { value: 'debt', label: 'Debt', icon: 'credit-card', color: '#FF6B6B' },
];

export default function AddPendingExpenseScreen() {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'bill' | 'debt'>('bill');
  const [category, setCategory] = useState('Electricity');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(dueDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(dueDate.getFullYear());
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(selectedYear, selectedMonth, day);
    setDueDate(newDate);
    setShowDatePicker(false);
  };

  const showSuccessAlert = (message: string, isError: boolean = false) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
    setTimeout(() => {
      setShowSuccessModal(false);
      if (!isError) {
        router.replace('/(tabs)/pending-expenses');
      }
    }, 1500);
  };

  const handleCancel = () => {
    router.replace('/(tabs)/pending-expenses');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showSuccessAlert('Please enter a title', true);
      return;
    }

    if (!amount) {
      showSuccessAlert('Please enter an amount', true);
      return;
    }

    const expenseAmount = parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      showSuccessAlert('Please enter a valid amount', true);
      return;
    }

    setLoading(true);

    const expenseData = {
      title: title.trim(),
      amount: expenseAmount,
      dueDate: dueDate,
      description: description.trim(),
      category: category,
      type: type, // Make sure type is included
    };

    console.log('Saving expense with type:', expenseData); // Debug log

    const result = await addPendingExpense(expenseData);

    if (result.success) {
      showSuccessAlert(`${type === 'bill' ? 'Bill' : 'Debt'} added successfully!`);
    } else {
      showSuccessAlert(result.error || 'Failed to add', true);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setTitle('');
    setAmount('');
    setDescription('');
    setType('bill');
    setCategory('Electricity');
    setDueDate(new Date());
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
    setShowTypeDropdown(false);
    setShowCategoryDropdown(false);
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  };

  const toggleTypeDropdown = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowTypeDropdown(!showTypeDropdown);
  };

  const selectType = (selectedType: 'bill' | 'debt') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setType(selectedType);
    setCategory(selectedType === 'bill' ? 'Electricity' : 'Credit Card');
    setShowTypeDropdown(false);
  };

  const toggleCategoryDropdown = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowCategoryDropdown(!showCategoryDropdown);
  };

  const selectCategory = (cat: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategory(cat);
    setShowCategoryDropdown(false);
  };

  const getCurrentCategories = () => {
    return type === 'bill' ? BILL_CATEGORIES : DEBT_CATEGORIES;
  };

  const CustomDatePicker = () => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay();
    const today = new Date();
    
    const isToday = (day: number) => {
      return today.getDate() === day && 
             today.getMonth() === selectedMonth && 
             today.getFullYear() === selectedYear;
    };

    const isSelectedDate = (day: number) => {
      return dueDate.getDate() === day && 
             dueDate.getMonth() === selectedMonth && 
             dueDate.getFullYear() === selectedYear;
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
                Select Due Date
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
                  selectedValue={selectedMonth}
                  onValueChange={(itemValue) => setSelectedMonth(itemValue)}
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
                  selectedValue={selectedYear}
                  onValueChange={(itemValue) => setSelectedYear(itemValue)}
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
                setSelectedMonth(today.getMonth());
                setSelectedYear(today.getFullYear());
                setDueDate(today);
                setShowDatePicker(false);
              }}
            >
              <Text style={{ color: '#90ee90', fontFamily: 'Poppins-SemiBold' }}>Select Today</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a472a' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1a472a" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#90ee90"
              colors={['#90ee90']}
              title="Refreshing..."
              titleColor="#90ee90"
            />
          }
        >
          <View style={{ padding: 20, paddingBottom: 40 }}>
            <View style={{ marginTop: 20, marginBottom: 20 }}>
              <Text style={{ color: '#ffffff', fontSize: 28, fontFamily: 'Poppins-Bold' }}>
                Add {type === 'bill' ? 'Bill' : 'Debt'}
              </Text>
            </View>

            {/* Type Selection */}
            <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular' }}>
              Type *
            </Text>
            <View style={{ marginBottom: 15 }}>
              <TouchableOpacity 
                onPress={toggleTypeDropdown}
                activeOpacity={0.7}
                style={{
                  backgroundColor: '#1a3a2a',
                  padding: 15,
                  borderRadius: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#2a5a3a',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon 
                    name={type === 'bill' ? 'file-text' : 'credit-card'} 
                    size={20} 
                    color={type === 'bill' ? '#4ECDC4' : '#FF6B6B'} 
                  />
                  <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Poppins-Regular' }}>
                    {type === 'bill' ? 'Bill' : 'Debt'}
                  </Text>
                </View>
                <Icon 
                  name={showTypeDropdown ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color="#90ee90" 
                />
              </TouchableOpacity>

              {showTypeDropdown && (
                <View style={{
                  marginTop: 5,
                  backgroundColor: '#1a3a2a',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#2a5a3a',
                  overflow: 'hidden',
                }}>
                  {TYPE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => selectType(option.value as 'bill' | 'debt')}
                      style={{
                        padding: 12,
                        paddingHorizontal: 15,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: type === option.value ? '#2a5a3a' : 'transparent',
                      }}
                    >
                      <Icon name={option.icon} size={20} color={option.color} />
                      <Text style={{
                        color: type === option.value ? '#90ee90' : '#ffffff',
                        fontSize: 14,
                        fontFamily: 'Poppins-Regular',
                      }}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular' }}>
              Title *
            </Text>
            <TextInput
              style={{
                backgroundColor: '#2a5a3a',
                padding: 15,
                borderRadius: 10,
                color: '#ffffff',
                marginBottom: 15,
                fontFamily: 'Poppins-Regular',
                fontSize: 16
              }}
              placeholder={type === 'bill' ? "e.g., Electricity Bill" : "e.g., Credit Card Debt"}
              placeholderTextColor="#90ee90"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular' }}>
              Amount *
            </Text>
            <TextInput
              style={{
                backgroundColor: '#2a5a3a',
                padding: 15,
                borderRadius: 10,
                color: '#ffffff',
                marginBottom: 15,
                fontFamily: 'Poppins-Regular',
                fontSize: 16
              }}
              placeholder="0.00"
              placeholderTextColor="#90ee90"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            {/* Category Dropdown */}
            <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular' }}>
              Category *
            </Text>
            <View style={{ marginBottom: 15 }}>
              <TouchableOpacity 
                onPress={toggleCategoryDropdown}
                activeOpacity={0.7}
                style={{
                  backgroundColor: '#1a3a2a',
                  padding: 15,
                  borderRadius: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#2a5a3a',
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Poppins-Regular' }}>
                  {category}
                </Text>
                <Icon 
                  name={showCategoryDropdown ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color="#90ee90" 
                />
              </TouchableOpacity>

              {showCategoryDropdown && (
                <View style={{
                  marginTop: 5,
                  backgroundColor: '#1a3a2a',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#2a5a3a',
                  overflow: 'hidden',
                  maxHeight: 200,
                }}>
                  <ScrollView 
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    style={{ maxHeight: 200 }}
                  >
                    {getCurrentCategories().map((cat, index) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => selectCategory(cat)}
                        style={{
                          padding: 12,
                          paddingHorizontal: 15,
                          borderBottomWidth: index !== getCurrentCategories().length - 1 ? 1 : 0,
                          borderBottomColor: '#2a5a3a',
                          backgroundColor: category === cat ? '#2a5a3a' : 'transparent',
                        }}
                      >
                        <Text style={{
                          color: category === cat ? '#90ee90' : '#ffffff',
                          fontSize: 14,
                          fontFamily: 'Poppins-Regular',
                        }}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular' }}>
              Due Date *
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#2a5a3a',
                padding: 15,
                borderRadius: 10,
                marginBottom: 15,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#4a8a6a',
              }}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular', fontSize: 16 }}>
                {dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
              <Icon name="calendar" size={22} color="#90ee90" />
            </TouchableOpacity>

            <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular' }}>
              Description (Optional)
            </Text>
            <TextInput
              style={{
                backgroundColor: '#2a5a3a',
                padding: 15,
                borderRadius: 10,
                color: '#ffffff',
                marginBottom: 20,
                fontFamily: 'Poppins-Regular',
                height: 100,
                textAlignVertical: 'top'
              }}
              placeholder="Add additional details..."
              placeholderTextColor="#90ee90"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            {/* Buttons Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#3a6a4a',
                  padding: 15,
                  borderRadius: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#4a8a6a',
                }}
                onPress={handleCancel}
              >
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold', fontFamily: 'Poppins-SemiBold' }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#90ee90',
                  padding: 15,
                  borderRadius: 10,
                  alignItems: 'center',
                  opacity: loading ? 0.7 : 1
                }}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1a472a" />
                ) : (
                  <Text style={{ color: '#1a472a', fontSize: 16, fontWeight: 'bold', fontFamily: 'Poppins-SemiBold' }}>
                    Add {type === 'bill' ? 'Bill' : 'Debt'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomDatePicker />

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
              backgroundColor: successMessage.includes('failed') || successMessage.includes('Please') ? '#3a1a1a' : '#4ECDC4',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <Icon 
                name={successMessage.includes('failed') || successMessage.includes('Please') ? 'alert-triangle' : 'check'} 
                size={28} 
                color={successMessage.includes('failed') || successMessage.includes('Please') ? '#ff6b6b' : '#1a472a'} 
              />
            </View>
            
            <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold', marginBottom: 6, textAlign: 'center' }}>
              {successMessage.includes('failed') || successMessage.includes('Please') ? 'Error' : 'Success!'}
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