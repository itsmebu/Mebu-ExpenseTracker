// app/(tabs)/recent-activity.tsx

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { deleteExpense, Expense, getExpenses } from '../../../store/expenses';
import { deleteShoppingItem, getShoppingItems, ShoppingItem } from '../../../store/shoppingList';
import { useAuth } from '../../hooks/useAuth';

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

export default function RecentActivityScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [combinedItems, setCombinedItems] = useState<CombinedItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'expenses' | 'shopping'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'expense' | 'shopping' } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const router = useRouter();
  const { refreshUserProfile } = useAuth();

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getPaymentDisplay = (method: string) => {
    switch(method) {
      case 'cash': return { icon: null, symbol: '₱', label: 'Cash', bgColor: '#3a6a4a' };
      case 'gcash': return { icon: 'phone', label: 'GCash', symbol: null, bgColor: '#2a5a3a' };
      case 'card': return { icon: 'credit-card', label: 'Card', symbol: null, bgColor: '#2a5a3a' };
      default: return { icon: null, symbol: '₱', label: 'Cash', bgColor: '#3a6a4a' };
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
      
      const expensesCombined: CombinedItem[] = allExpenses.map(exp => ({
        id: exp.id!,
        name: exp.name || exp.category || 'Unnamed Expense',
        amount: exp.amount,
        category: exp.category,
        date: exp.date,
        note: exp.note,
        paymentMethod: exp.paymentMethod || 'cash',
        type: 'expense',
        timestamp: exp.date.getTime()
      }));
      
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
      setSelectionMode(false);
      setSelectedItems(new Set());
      
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

  const handleDeleteAll = async () => {
    const itemsToDelete = [...selectedItems];
    let successCount = 0;
    let failCount = 0;
    
    for (const itemId of itemsToDelete) {
      // Find the item type
      const item = combinedItems.find(i => i.id === itemId);
      if (!item) continue;
      
      let result;
      if (item.type === 'expense') {
        result = await deleteExpense(itemId);
      } else {
        result = await deleteShoppingItem(itemId);
      }
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    setShowDeleteAllModal(false);
    setSelectionMode(false);
    setSelectedItems(new Set());
    await loadData();
    
    if (successCount > 0) {
      showModalMessage(`Successfully deleted ${successCount} item${successCount !== 1 ? 's' : ''}`);
    } else if (failCount > 0) {
      showModalMessage('Failed to delete items', true);
    }
  };

  const openDeleteModal = (id: string, type: 'expense' | 'shopping') => {
    setItemToDelete({ id, type });
    setShowDeleteModal(true);
  };

  const toggleSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
    
    if (newSelection.size === 0) {
      setSelectionMode(false);
    }
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedItems(new Set());
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedItems(new Set());
  };

  const getCategoryIcon = (category: string) => {
    switch(category.toLowerCase()) {
      case 'food': return 'coffee';
      case 'transport': return 'truck';
      case 'transportation': return 'truck';
      case 'shopping': return 'shopping-bag';
      case 'bills': return 'file-text';
      case 'entertainment': return 'film';
      case 'health': return 'heart';
      case 'education': return 'book';
      case 'travel': return 'map-pin';
      case 'subscriptions': return 'repeat';
      case 'personal care': return 'user';
      case 'other': return 'tag';
      default: return 'tag';
    }
  };

  const getFilteredItems = () => {
    if (filter === 'expenses') {
      return combinedItems.filter(item => item.type === 'expense');
    } else if (filter === 'shopping') {
      return combinedItems.filter(item => item.type === 'shopping');
    }
    return combinedItems;
  };

  const renderItem = ({ item }: { item: CombinedItem }) => {
    const paymentDisplay = getPaymentDisplay(item.paymentMethod || 'cash');
    const isExpense = item.type === 'expense';
    const isShopping = item.type === 'shopping';
    const isSelected = selectedItems.has(item.id);
    
    return (
      <TouchableOpacity
        onLongPress={() => !selectionMode && enterSelectionMode()}
        onPress={() => {
          if (selectionMode) {
            toggleSelection(item.id);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={{
          backgroundColor: isShopping ? '#1a3a2a' : '#2a5a3a',
          padding: 15,
          borderRadius: 10,
          marginBottom: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderWidth: selectionMode && isSelected ? 2 : 0,
          borderColor: '#90ee90',
        }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
              {selectionMode && (
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: '#90ee90',
                  backgroundColor: isSelected ? '#90ee90' : 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 8,
                }}>
                  {isSelected && <Icon name="check" size={14} color="#1a472a" />}
                </View>
              )}
              <Icon name={getCategoryIcon(item.category)} size={12} color="#90ee90" />
              <Text style={{ color: '#90ee90', fontSize: 10, fontFamily: 'Poppins-Regular' }}>
                {item.category}
              </Text>
              {isShopping && (
                <View style={{ 
                  backgroundColor: '#4ECDC4', 
                  paddingHorizontal: 6, 
                  paddingVertical: 2, 
                  borderRadius: 4,
                }}>
                  <Text style={{ color: '#1a472a', fontSize: 8, fontFamily: 'Poppins-SemiBold' }}>
                    Shopping
                  </Text>
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
            
            <Text style={{ color: '#c0e0c0', fontSize: 10, fontFamily: 'Poppins-Regular', marginBottom: 2 }}>
              {formatDateTime(item.date)} at {formatTime(item.date)}
            </Text>
            
            {item.note && !isShopping && (
              <Text style={{ color: '#90ee90', fontSize: 11, fontFamily: 'Poppins-Regular', marginTop: 4 }}>
                Note: {item.note}
              </Text>
            )}
          </View>
          
          {!selectionMode && (
            <TouchableOpacity onPress={() => openDeleteModal(item.id, item.type)}>
              <Icon name="trash-2" size={20} color="#ff6b6b" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const getTotalByType = () => {
    const expensesTotal = combinedItems
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);
    const shoppingTotal = combinedItems
      .filter(item => item.type === 'shopping')
      .reduce((sum, item) => sum + item.amount, 0);
    return { expensesTotal, shoppingTotal };
  };

  const { expensesTotal, shoppingTotal } = getTotalByType();
  const filteredItems = getFilteredItems();
  const selectedCount = selectedItems.size;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a472a' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1a472a" />
      
      <View style={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontSize: 28, fontFamily: 'Poppins-Bold' }}>
            Recent Activity
          </Text>
          {!selectionMode && combinedItems.length > 0 && (
            <TouchableOpacity onPress={enterSelectionMode}>
              <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold' }}>
                Select
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {selectionMode && (
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: '#2a5a3a',
          }}>
            <Text style={{ color: '#90ee90', fontSize: 12, fontFamily: 'Poppins-Regular' }}>
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {selectedCount > 0 && (
                <TouchableOpacity onPress={() => setShowDeleteAllModal(true)}>
                  <Text style={{ color: '#ff6b6b', fontSize: 14, fontFamily: 'Poppins-SemiBold' }}>
                    Delete All
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={cancelSelection}>
                <Text style={{ color: '#90ee90', fontSize: 14, fontFamily: 'Poppins-SemiBold' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 15 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity 
            style={{ 
              flex: 1, 
              backgroundColor: filter === 'expenses' ? '#3a6a4a' : '#2a5a3a',
              padding: 12,
              borderRadius: 10,
              alignItems: 'center',
              borderWidth: filter === 'expenses' ? 1 : 0,
              borderColor: '#90ee90',
            }}
            onPress={() => setFilter('expenses')}
          >
            <Icon name="credit-card" size={20} color="#90ee90" />
            <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Poppins-Bold', marginTop: 4 }}>
              ₱{formatNumber(expensesTotal)}
            </Text>
            <Text style={{ color: '#90ee90', fontSize: 10, fontFamily: 'Poppins-Regular' }}>
              Expenses
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={{ 
              flex: 1, 
              backgroundColor: filter === 'shopping' ? '#2a5a3a' : '#1a3a2a',
              padding: 12,
              borderRadius: 10,
              alignItems: 'center',
              borderWidth: filter === 'shopping' ? 1 : 0,
              borderColor: '#4ECDC4',
            }}
            onPress={() => setFilter('shopping')}
          >
            <Icon name="shopping-bag" size={20} color="#4ECDC4" />
            <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Poppins-Bold', marginTop: 4 }}>
              ₱{formatNumber(shoppingTotal)}
            </Text>
            <Text style={{ color: '#90ee90', fontSize: 10, fontFamily: 'Poppins-Regular' }}>
              Shopping
            </Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={{ 
            marginTop: 10,
            backgroundColor: filter === 'all' ? '#3a6a4a' : '#2a5a3a',
            padding: 10,
            borderRadius: 10,
            alignItems: 'center',
            borderWidth: filter === 'all' ? 1 : 0,
            borderColor: '#90ee90',
          }}
          onPress={() => setFilter('all')}
        >
          <Text style={{ color: '#90ee90', fontFamily: 'Poppins-SemiBold' }}>
            View All ({combinedItems.length} items)
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
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
          <View style={{ alignItems: 'center', padding: 60 }}>
            <Icon name="inbox" size={60} color="#90ee90" opacity={0.5} />
            <Text style={{ color: '#c0e0c0', textAlign: 'center', fontFamily: 'Poppins-Regular', marginTop: 15, fontSize: 16 }}>
              No {filter !== 'all' ? filter : ''} activities yet
            </Text>
            <Text style={{ color: '#90ee90', textAlign: 'center', fontFamily: 'Poppins-Regular', marginTop: 5, fontSize: 12 }}>
              {filter === 'expenses' ? 'Add expenses using the + button' : 
               filter === 'shopping' ? 'Complete shopping items to see them here' : 
               'Add expenses or complete shopping items'}
            </Text>
          </View>
        }
      />

      {/* Single Delete Modal */}
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
              Delete All Selected
            </Text>
            
            <Text style={{ color: '#c0e0c0', fontSize: 14, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 20 }}>
              Are you sure you want to delete {selectedCount} selected item{selectedCount !== 1 ? 's' : ''}? This action cannot be undone.
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
                onPress={() => setShowDeleteAllModal(false)}
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
                onPress={handleDeleteAll}
              >
                <Text style={{ color: '#ffffff', fontFamily: 'Poppins-SemiBold', fontSize: 14 }}>Delete All</Text>
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