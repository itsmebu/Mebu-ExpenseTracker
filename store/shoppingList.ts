// store/shoppingList.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { Timestamp, addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface ShoppingItem {
  id?: string;
  name: string;
  price: number;
  category: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  paymentMethod?: string;
  userId: string;
  firebaseId?: string;
  synced?: boolean;
}

const SHOPPING_STORAGE_KEY = '@mebu/shopping';

// Helper to get storage key
const getStorageKey = (userId: string) => `${SHOPPING_STORAGE_KEY}_${userId}`;

// Save all shopping items to local storage
const saveToLocalStorage = async (userId: string, items: ShoppingItem[]) => {
  try {
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(items));
  } catch (error) {
    console.error('Save to local storage error:', error);
  }
};

// Load shopping items from local storage
const loadFromLocalStorage = async (userId: string): Promise<ShoppingItem[]> => {
  try {
    const data = await AsyncStorage.getItem(getStorageKey(userId));
    if (data) {
      const items = JSON.parse(data);
      return items.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
      }));
    }
  } catch (error) {
    console.error('Load from local storage error:', error);
  }
  return [];
};

// Add a new shopping item
export const addShoppingItem = async (name: string, price: number = 0, category: string = 'Other') => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    const itemId = Crypto.randomUUID();
    
    const itemData: ShoppingItem = {
      id: itemId,
      name: name.trim(),
      price: price,
      category: category,
      completed: false,
      createdAt: new Date(),
      userId: userId,
      synced: false,
    };
    
    // Save to local storage first
    const existingItems = await loadFromLocalStorage(userId);
    existingItems.unshift(itemData);
    await saveToLocalStorage(userId, existingItems);
    console.log('Shopping item saved locally:', itemData.name);
    
    // Try to sync to Firebase if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      try {
        const firebaseData = {
          name: itemData.name,
          price: itemData.price,
          category: itemData.category,
          completed: false,
          createdAt: Timestamp.now(),
          userId: userId,
        };
        
        const docRef = await addDoc(collection(db, 'shoppingList'), firebaseData);
        
        // Update local record with firebaseId and mark as synced
        itemData.firebaseId = docRef.id;
        itemData.synced = true;
        const updatedItems = await loadFromLocalStorage(userId);
        const index = updatedItems.findIndex(i => i.id === itemId);
        if (index !== -1) {
          updatedItems[index] = itemData;
          await saveToLocalStorage(userId, updatedItems);
        }
        console.log('Shopping item synced to Firebase');
      } catch (firebaseError) {
        console.log('Firebase sync failed, will retry later');
      }
    }
    
    return { success: true, id: itemId };
  } catch (error: any) {
    console.error('Add shopping item error:', error);
    return { success: false, error: error.message };
  }
};

// Get all shopping items for current user
export const getShoppingItems = async (): Promise<ShoppingItem[]> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    
    // Try to load from local storage first
    const localItems = await loadFromLocalStorage(userId);
    if (localItems.length > 0) {
      console.log('Returning shopping items from local storage:', localItems.length);
      return localItems;
    }
    
    // If no local data, fetch from Firebase
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return [];
    }
    
    const q = query(
      collection(db, 'shoppingList'), 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const items: ShoppingItem[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      items.push({
        id: doc.id,
        firebaseId: doc.id,
        name: data.name,
        price: data.price,
        category: data.category || 'Other',
        completed: data.completed,
        createdAt: data.createdAt.toDate(),
        completedAt: data.completedAt?.toDate(),
        paymentMethod: data.paymentMethod,
        userId: data.userId,
        synced: true,
      });
    });
    
    // Save to local storage for offline use
    await saveToLocalStorage(userId, items);
    
    return items;
  } catch (error) {
    console.error('Get shopping items error:', error);
    return [];
  }
};

// Update shopping item
export const updateShoppingItem = async (itemId: string, updates: Partial<ShoppingItem>) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    // Update local storage
    const localItems = await loadFromLocalStorage(userId);
    const itemIndex = localItems.findIndex(i => i.id === itemId);
    
    if (itemIndex !== -1) {
      localItems[itemIndex] = { ...localItems[itemIndex], ...updates, synced: false };
      await saveToLocalStorage(userId, localItems);
    }
    
    // Try to update Firebase if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      const firebaseId = localItems[itemIndex]?.firebaseId;
      if (firebaseId) {
        try {
          const itemRef = doc(db, 'shoppingList', firebaseId);
          const updateData: any = { ...updates };
          
          // When marking as complete, set completedAt timestamp
          if (updates.completed !== undefined) {
            updateData.completedAt = updates.completed ? Timestamp.now() : null;
          }
          
          await updateDoc(itemRef, updateData);
          
          // Mark as synced
          if (itemIndex !== -1) {
            localItems[itemIndex].synced = true;
            await saveToLocalStorage(userId, localItems);
          }
        } catch (firebaseError) {
          console.log('Firebase update failed, will retry later');
        }
      } else if (Object.keys(updates).length > 0) {
        // This is a new item that hasn't been synced yet
        const firebaseData = {
          name: localItems[itemIndex].name,
          price: localItems[itemIndex].price,
          category: localItems[itemIndex].category,
          completed: localItems[itemIndex].completed,
          createdAt: Timestamp.fromDate(localItems[itemIndex].createdAt),
          userId: userId,
        };
        
        const docRef = await addDoc(collection(db, 'shoppingList'), firebaseData);
        localItems[itemIndex].firebaseId = docRef.id;
        localItems[itemIndex].synced = true;
        await saveToLocalStorage(userId, localItems);
      }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Update shopping item error:', error);
    return { success: false, error: error.message };
  }
};

// Delete shopping item
export const deleteShoppingItem = async (itemId: string) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    // Get the item before deleting
    const localItems = await loadFromLocalStorage(userId);
    const itemToDelete = localItems.find(i => i.id === itemId);
    
    // Delete from local storage
    const filtered = localItems.filter(i => i.id !== itemId);
    await saveToLocalStorage(userId, filtered);
    
    // Try to delete from Firebase if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && itemToDelete?.firebaseId) {
      try {
        await deleteDoc(doc(db, 'shoppingList', itemToDelete.firebaseId));
      } catch (firebaseError) {
        console.log('Firebase delete failed, will retry later');
      }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Delete shopping item error:', error);
    return { success: false, error: error.message };
  }
};

// Sync all unsynced shopping items
export const syncShoppingItems = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return { success: false, error: 'No user logged in' };
    
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return { success: false, error: 'No internet' };
    }
    
    const localItems = await loadFromLocalStorage(userId);
    const unsynced = localItems.filter(i => !i.synced);
    
    console.log(`Syncing ${unsynced.length} unsynced shopping items`);
    
    for (const item of unsynced) {
      try {
        if (!item.firebaseId) {
          // New item - add to Firebase
          const firebaseData = {
            name: item.name,
            price: item.price,
            category: item.category,
            completed: item.completed,
            completedAt: item.completedAt ? Timestamp.fromDate(item.completedAt) : null,
            createdAt: Timestamp.fromDate(item.createdAt),
            userId: userId,
          };
          
          const docRef = await addDoc(collection(db, 'shoppingList'), firebaseData);
          item.firebaseId = docRef.id;
          item.synced = true;
          console.log('Synced new shopping item:', item.name);
        } else {
          // Update existing item
          const itemRef = doc(db, 'shoppingList', item.firebaseId);
          await updateDoc(itemRef, {
            name: item.name,
            price: item.price,
            category: item.category,
            completed: item.completed,
            completedAt: item.completedAt ? Timestamp.fromDate(item.completedAt) : null,
          });
          item.synced = true;
          console.log('Synced updated shopping item:', item.name);
        }
      } catch (error) {
        console.error('Sync shopping item failed:', item.id, error);
      }
    }
    
    await saveToLocalStorage(userId, localItems);
    return { success: true, syncedCount: unsynced.length };
  } catch (error) {
    console.error('Sync shopping items error:', error);
    return { success: false, error };
  }
};