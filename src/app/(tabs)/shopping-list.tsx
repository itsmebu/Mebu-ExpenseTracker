// app/(tabs)/shopping-list.tsx

import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { Category, getCategories } from '../../../store/expenses';
import {
  addShoppingItem,
  deleteShoppingItem,
  getShoppingItems,
  ShoppingItem,
  updateShoppingItem
} from '../../../store/shoppingList';

const { height } = Dimensions.get('window');
const categoriesList = [
  'Food', 'Transport', 'Shopping', 'Bills', 
  'Entertainment', 'Health', 'Education', 'Other'
];

// Payment methods
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', symbol: '₱', icon: null },
  { value: 'gcash', label: 'GCash', symbol: null, icon: 'phone' },
  { value: 'card', label: 'Card', symbol: null, icon: 'credit-card' },
];

export default function ShoppingListScreen() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemName, setItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Other');
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShoppingItem | null>(null);
  const [tempPrice, setTempPrice] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ShoppingItem | null>(null);
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
  const router = useRouter();

  const loadItems = async () => {
    const allItems = await getShoppingItems();
    setItems(allItems);
  };

  const loadCategories = async () => {
    const cats = await getCategories();
    if (cats.length > 0) {
      setCategories(cats);
    } else {
      setCategories(categoriesList.map(cat => ({ name: cat, userId: '' })));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadItems(), loadCategories()]);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadItems();
      loadCategories();
      // Exit selection mode when leaving screen
      return () => {
        setSelectionMode(false);
        setSelectedItems(new Set());
      };
    }, [])
  );

  const handleAddItem = async () => {
    if (!itemName.trim()) {
      return;
    }

    const result = await addShoppingItem(itemName, 0, selectedCategory);
    if (result.success) {
      setItemName('');
      setSelectedCategory('Other');
      setShowAddModal(false);
      loadItems();
    }
  };

  const handleToggleComplete = async (item: ShoppingItem) => {
    if (!item.completed) {
      setSelectedItem(item);
      setTempPrice('');
      setSelectedPaymentMethod('cash');
      setShowPriceModal(true);
    } else {
      const result = await updateShoppingItem(item.id!, { 
        completed: false,
        price: 0,
        paymentMethod: undefined
      });
      if (result.success) {
        loadItems();
      }
    }
  };

  const handleConfirmPrice = async () => {
    if (!selectedItem) return;
    
    const price = parseFloat(tempPrice);
    if (isNaN(price) || price <= 0) {
      return;
    }

    const result = await updateShoppingItem(selectedItem.id!, { 
      completed: true,
      price: price,
      paymentMethod: selectedPaymentMethod
    });
    
    if (result.success) {
      setShowPriceModal(false);
      setSelectedItem(null);
      setTempPrice('');
      setSelectedPaymentMethod('cash');
      loadItems();
    }
  };

  const handleEditItem = async () => {
    if (!editingItem) return;

    const result = await updateShoppingItem(editingItem.id!, {
      name: editName.trim(),
      category: editCategory,
    });
    
    if (result.success) {
      setShowEditModal(false);
      setEditingItem(null);
      setEditName('');
      setEditCategory('');
      loadItems();
    }
  };

  const openEditModal = (item: ShoppingItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCategory(item.category || 'Other');
    setShowEditModal(true);
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    
    const result = await deleteShoppingItem(itemToDelete.id!);
    if (result.success) {
      setShowDeleteModal(false);
      setItemToDelete(null);
      loadItems();
    }
  };

  const handleDeleteAllSelected = async () => {
    const itemsToDelete = Array.from(selectedItems);
    let successCount = 0;
    
    for (const itemId of itemsToDelete) {
      const result = await deleteShoppingItem(itemId);
      if (result.success) {
        successCount++;
      }
    }
    
    setShowDeleteAllModal(false);
    setSelectionMode(false);
    setSelectedItems(new Set());
    loadItems();
  };

  const openDeleteModal = (item: ShoppingItem) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedItems(new Set());
  };

  const handleLongPress = (itemId: string) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    longPressTimer.current = setTimeout(() => {
      enterSelectionMode();
      toggleItemSelection(itemId);
    }, 500);
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
    
    // Exit selection mode if no items selected
    if (newSelection.size === 0) {
      setSelectionMode(false);
    }
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedItems(new Set());
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getTotalCompleted = () => {
    return items
      .filter(item => item.completed)
      .reduce((sum, item) => sum + item.price, 0);
  };

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'Food': return 'coffee';
      case 'Transport': return 'truck';
      case 'Shopping': return 'shopping-bag';
      case 'Bills': return 'file-text';
      case 'Entertainment': return 'film';
      case 'Health': return 'heart';
      case 'Education': return 'book';
      default: return 'tag';
    }
  };

  const getPaymentDisplay = (method: string) => {
    switch(method) {
      case 'cash': return { icon: null, symbol: '₱', label: 'Cash' };
      case 'gcash': return { icon: 'phone', symbol: null, label: 'GCash' };
      case 'card': return { icon: 'credit-card', symbol: null, label: 'Card' };
      default: return { icon: null, symbol: '₱', label: 'Cash' };
    }
  };

  const recentCompletedItems = items
    .filter(item => item.completed)
    .slice(0, 5);

  const renderItem = ({ item }: { item: ShoppingItem }) => {
    const isSelected = selectedItems.has(item.id!);
    const paymentDisplay = item.completed && item.paymentMethod ? getPaymentDisplay(item.paymentMethod) : null;
    
    return (
      <TouchableOpacity 
        onLongPress={() => !item.completed && handleLongPress(item.id!)}
        onPress={() => {
          if (selectionMode && !item.completed) {
            toggleItemSelection(item.id!);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={{
          backgroundColor: item.completed ? '#1a3a2a' : (isSelected ? '#3a6a4a' : '#2a5a3a'),
          padding: 15,
          borderRadius: 10,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: item.completed ? 0.7 : 1,
          borderWidth: isSelected ? 2 : 0,
          borderColor: '#90ee90',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {selectionMode && !item.completed && (
              <TouchableOpacity onPress={() => toggleItemSelection(item.id!)}>
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: '#90ee90',
                  backgroundColor: isSelected ? '#90ee90' : 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  {isSelected && <Icon name="check" size={14} color="#1a472a" />}
                </View>
              </TouchableOpacity>
            )}
            
            {(!selectionMode || item.completed) && (
              <TouchableOpacity onPress={() => handleToggleComplete(item)}>
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: '#90ee90',
                  backgroundColor: item.completed ? '#90ee90' : 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  {item.completed && <Icon name="check" size={14} color="#1a472a" />}
                </View>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              onPress={() => !item.completed && !selectionMode && openEditModal(item)}
              style={{ flex: 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                <Icon name={getCategoryIcon(item.category || 'Other')} size={12} color="#90ee90" />
                <Text style={{
                  color: '#90ee90',
                  fontSize: 10,
                  fontFamily: 'Poppins-Regular',
                }}>
                  {item.category || 'Other'}
                </Text>
                {item.completed && paymentDisplay && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    {paymentDisplay.icon ? (
                      <Icon name={paymentDisplay.icon} size={10} color="#4ECDC4" />
                    ) : (
                      <Text style={{ color: '#4ECDC4', fontSize: 10, fontFamily: 'Poppins-Bold' }}>{paymentDisplay.symbol}</Text>
                    )}
                    <Text style={{ color: '#4ECDC4', fontSize: 8, fontFamily: 'Poppins-Regular' }}>
                      {paymentDisplay.label}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{
                color: '#ffffff',
                fontSize: 16,
                fontFamily: 'Poppins-SemiBold',
                textDecorationLine: item.completed ? 'line-through' : 'none',
              }}>
                {item.name}
              </Text>
              {item.completed && (
                <Text style={{
                  color: '#90ee90',
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  marginTop: 2,
                }}>
                  ₱{formatNumber(item.price)}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          {!item.completed && !selectionMode && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => openEditModal(item)}>
                <Icon name="edit-2" size={18} color="#90ee90" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openDeleteModal(item)}>
                <Icon name="trash-2" size={18} color="#ff6b6b" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const completedTotal = getTotalCompleted();
  const completedCount = items.filter(item => item.completed).length;
  const pendingCount = items.filter(item => !item.completed).length;
  const pendingItems = items.filter(item => !item.completed);
  const displayCategories = categories.length > 0 ? categories : categoriesList.map(c => ({ name: c, userId: '' }));
  const selectedCount = selectedItems.size;

  // Reusable Modal component with keyboard handling
  const ResponsiveModal = ({ visible, onClose, children }: any) => (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
              width: '90%',
              maxWidth: 320,
              borderWidth: 1,
              borderColor: '#4a8a6a',
              maxHeight: '90%',
            }}>
              {children}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a472a' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1a472a" />
      
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop:40 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ color: '#ffffff', fontSize: 28, fontFamily: 'Poppins-Bold' }}>
            Shopping List
          </Text>
          
          {/* Selection Mode Actions */}
          {selectionMode ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {selectedCount > 0 && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#ff6b6b',
                    padding: 10,
                    borderRadius: 10,
                    width: 44,
                    height: 44,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                  onPress={() => setShowDeleteAllModal(true)}
                >
                  <Icon name="trash-2" size={20} color="#ffffff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={{
                  backgroundColor: '#3a6a4a',
                  padding: 10,
                  borderRadius: 10,
                  width: 44,
                  height: 44,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
                onPress={cancelSelection}
              >
                <Icon name="x" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {pendingCount > 0 && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#2a5a3a',
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 7,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onPress={enterSelectionMode}
                >
                  <Icon name="check-square" size={15} color="#90ee90" />
                  <Text style={{ color: '#90ee90', fontFamily: 'Poppins-SemiBold', fontSize: 10 }}>
                    Select
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={{
                  backgroundColor: '#90ee90',
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
                onPress={() => setShowAddModal(true)}
              >
                <Icon name="plus" size={18} color="#1a472a" />
                <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold', fontSize: 14 }}>
                  Add Item
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Summary Cards */}
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
              Pending Items
            </Text>
            <Text style={{ color: '#ffffff', fontSize: 24, fontFamily: 'Poppins-Bold' }}>
              {pendingCount}
            </Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: '#1a3a2a',
            padding: 15,
            borderRadius: 12,
          }}>
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
              Completed Total
            </Text>
            <Text style={{ color: '#4ECDC4', fontSize: 20, fontFamily: 'Poppins-Bold' }}>
              ₱{formatNumber(completedTotal)}
            </Text>
            <Text style={{ color: '#c0e0c0', fontSize: 10, fontFamily: 'Poppins-Regular', marginTop: 2 }}>
              {completedCount} item{completedCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Selection Mode Info */}
        {selectionMode && (
          <View style={{
            backgroundColor: '#3a6a4a',
            padding: 10,
            borderRadius: 10,
            marginBottom: 10,
            alignItems: 'center',
          }}>
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </Text>
          </View>
        )}

        {/* Main Content - Scrollable with bottom padding */}
        <FlatList
          data={pendingItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id!}
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
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: 40, minHeight: height * 0.3 }}>
              <Icon name="shopping-bag" size={50} color="#90ee90" opacity={0.5} />
              <Text style={{ color: '#c0e0c0', textAlign: 'center', fontFamily: 'Poppins-Regular', marginTop: 10 }}>
                No pending items. Tap "Add Item" to create your shopping list.
              </Text>
              <Text style={{ color: '#90ee90', textAlign: 'center', fontFamily: 'Poppins-Regular', fontSize: 12, marginTop: 5 }}>
                Long press on an item to enter selection mode
              </Text>
            </View>
          }
          ListFooterComponent={
            recentCompletedItems.length > 0 ? (
              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ color: '#90ee90', fontSize: 16, fontFamily: 'Poppins-SemiBold' }}>
                    Recent Purchases
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/recent-activity')}>
                    <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
                      View All
                    </Text>
                  </TouchableOpacity>
                </View>
                {recentCompletedItems.map((item) => {
                  const paymentDisplay = item.paymentMethod ? getPaymentDisplay(item.paymentMethod) : null;
                  return (
                    <View key={item.id} style={{
                      backgroundColor: '#1a3a2a',
                      padding: 12,
                      borderRadius: 10,
                      marginBottom: 8,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
                            {item.category || 'Other'}
                          </Text>
                          {paymentDisplay && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              {paymentDisplay.icon ? (
                                <Icon name={paymentDisplay.icon} size={10} color="#4ECDC4" />
                              ) : (
                                <Text style={{ color: '#4ECDC4', fontSize: 10, fontFamily: 'Poppins-Bold' }}>{paymentDisplay.symbol}</Text>
                              )}
                              <Text style={{ color: '#4ECDC4', fontSize: 8, fontFamily: 'Poppins-Regular' }}>
                                {paymentDisplay.label}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: 'Poppins-Regular', textDecorationLine: 'line-through' }}>
                          {item.name}
                        </Text>
                      </View>
                      <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold' }}>
                        ₱{formatNumber(item.price)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null
          }
        />
      </View>

      {/* Add Item Modal */}
      <ResponsiveModal visible={showAddModal} onClose={() => setShowAddModal(false)}>
        <View style={{ alignItems: 'center', marginBottom: 15 }}>
          <View style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: '#2a5a3a',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 10,
          }}>
            <Icon name="shopping-bag" size={28} color="#90ee90" />
          </View>
          <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold' }}>
            Add Shopping Item
          </Text>
        </View>

        <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular', fontSize: 12 }}>
          Item Name
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
          placeholder="Enter item name"
          placeholderTextColor="#90ee90"
          value={itemName}
          onChangeText={setItemName}
          autoFocus
        />

        <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular', fontSize: 12 }}>
          Category
        </Text>
        <View style={{ 
          backgroundColor: '#2a5a3a', 
          borderRadius: 10, 
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: '#4a8a6a',
          marginBottom: 20,
        }}>
          <Picker
            selectedValue={selectedCategory}
            onValueChange={(itemValue) => setSelectedCategory(itemValue)}
            dropdownIconColor="#90ee90"
            style={{ color: '#ffffff', backgroundColor: '#2a5a3a', height: 50 }}
          >
            {displayCategories.map((cat) => (
              <Picker.Item 
                key={cat.name} 
                label={cat.name} 
                value={cat.name} 
                color="#ffffff"
                style={{ backgroundColor: '#2a5a3a' }}
              />
            ))}
          </Picker>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: '#3a6a4a',
              padding: 12,
              borderRadius: 10,
              alignItems: 'center',
            }}
            onPress={() => setShowAddModal(false)}
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
            onPress={handleAddItem}
          >
            <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </ResponsiveModal>

      {/* Price Input Modal with Payment Method */}
      <ResponsiveModal visible={showPriceModal} onClose={() => setShowPriceModal(false)}>
        <View style={{ alignItems: 'center', marginBottom: 15 }}>
          <View style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: '#2a5a3a',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 10,
          }}>
            <Text style={{ color: '#90ee90', fontSize: 32, fontFamily: 'Poppins-Bold' }}>₱</Text>
          </View>
          <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold' }}>
            Confirm Purchase
          </Text>
          <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', textAlign: 'center', marginTop: 5 }}>
            {selectedItem?.name}
          </Text>
        </View>

        <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular', fontSize: 12 }}>
          Payment Method
        </Text>
        <View style={{
          flexDirection: 'row',
          gap: 10,
          marginBottom: 15,
        }}>
          {PAYMENT_METHODS.map((method) => (
            <TouchableOpacity
              key={method.value}
              style={{
                flex: 1,
                backgroundColor: selectedPaymentMethod === method.value ? '#3a6a4a' : '#2a5a3a',
                padding: 10,
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

        <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular', fontSize: 12 }}>
          How much did you pay? (₱)
        </Text>
        <TextInput
          style={{
            backgroundColor: '#2a5a3a',
            padding: 12,
            borderRadius: 10,
            color: '#ffffff',
            marginBottom: 20,
            fontFamily: 'Poppins-Regular',
            fontSize: 16,
          }}
          placeholder="0.00"
          placeholderTextColor="#90ee90"
          value={tempPrice}
          onChangeText={setTempPrice}
          keyboardType="decimal-pad"
          autoFocus
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: '#3a6a4a',
              padding: 12,
              borderRadius: 10,
              alignItems: 'center',
            }}
            onPress={() => {
              setShowPriceModal(false);
              setSelectedItem(null);
              setTempPrice('');
              setSelectedPaymentMethod('cash');
            }}
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
            onPress={handleConfirmPrice}
          >
            <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </ResponsiveModal>

      {/* Edit Item Modal */}
      <ResponsiveModal visible={showEditModal} onClose={() => setShowEditModal(false)}>
        <View style={{ alignItems: 'center', marginBottom: 15 }}>
          <View style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: '#2a5a3a',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 10,
          }}>
            <Icon name="edit-2" size={28} color="#90ee90" />
          </View>
          <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold' }}>
            Edit Item
          </Text>
        </View>

        <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular', fontSize: 12 }}>
          Item Name
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
          placeholder="Item name"
          placeholderTextColor="#90ee90"
          value={editName}
          onChangeText={setEditName}
        />

        <Text style={{ color: '#90ee90', marginBottom: 5, fontFamily: 'Poppins-Regular', fontSize: 12 }}>
          Category
        </Text>
        <View style={{ 
          backgroundColor: '#2a5a3a', 
          borderRadius: 10, 
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: '#4a8a6a',
          marginBottom: 20,
        }}>
          <Picker
            selectedValue={editCategory}
            onValueChange={(itemValue) => setEditCategory(itemValue)}
            dropdownIconColor="#90ee90"
            style={{ color: '#ffffff', backgroundColor: '#2a5a3a', height: 50 }}
          >
            {displayCategories.map((cat) => (
              <Picker.Item 
                key={cat.name} 
                label={cat.name} 
                value={cat.name} 
                color="#ffffff"
                style={{ backgroundColor: '#2a5a3a' }}
              />
            ))}
          </Picker>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: '#3a6a4a',
              padding: 12,
              borderRadius: 10,
              alignItems: 'center',
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
            onPress={handleEditItem}
          >
            <Text style={{ color: '#1a472a', fontFamily: 'Poppins-SemiBold' }}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ResponsiveModal>

      {/* Single Delete Confirmation Modal */}
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
              backgroundColor: '#3a1a1a',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <Icon name="alert-triangle" size={28} color="#ff6b6b" />
            </View>
            <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold', marginBottom: 8, textAlign: 'center' }}>
              Delete Item
            </Text>
            <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 20 }}>
              Are you sure you want to delete "{itemToDelete?.name}"?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#3a6a4a',
                  padding: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#ff6b6b',
                  padding: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleDeleteItem}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-SemiBold' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete All Confirmation Modal */}
      <Modal
        visible={showDeleteAllModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteAllModal(false)}
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
              backgroundColor: '#3a1a1a',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <Icon name="alert-triangle" size={28} color="#ff6b6b" />
            </View>
            <Text style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Poppins-Bold', marginBottom: 8, textAlign: 'center' }}>
              Delete Selected Items
            </Text>
            <Text style={{ color: '#c0e0c0', fontSize: 12, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 20 }}>
              Are you sure you want to delete {selectedCount} selected item{selectedCount !== 1 ? 's' : ''}? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#3a6a4a',
                  padding: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={() => setShowDeleteAllModal(false)}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-Regular' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#ff6b6b',
                  padding: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleDeleteAllSelected}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-SemiBold' }}>Delete All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}