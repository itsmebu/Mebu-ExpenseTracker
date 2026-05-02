// store/pendingExpenses.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { Timestamp, addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface PendingExpense {
  id?: string;
  title: string;
  amount: number;
  dueDate: Date;
  description?: string;
  category: string;
  type: 'bill' | 'debt';
  isPaid: boolean;
  paidDate?: Date;
  paymentMethod?: string;
  userId: string;
  createdAt: Date;
  firebaseId?: string;
  synced?: boolean;
}

const PENDING_STORAGE_KEY = '@mebu/pending';

// Helper to get storage key
const getStorageKey = (userId: string) => `${PENDING_STORAGE_KEY}_${userId}`;

// Save all pending expenses to local storage
const saveToLocalStorage = async (userId: string, expenses: PendingExpense[]) => {
  try {
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(expenses));
  } catch (error) {
    console.error('Save to local storage error:', error);
  }
};

// Load pending expenses from local storage
const loadFromLocalStorage = async (userId: string): Promise<PendingExpense[]> => {
  try {
    const data = await AsyncStorage.getItem(getStorageKey(userId));
    if (data) {
      const expenses = JSON.parse(data);
      return expenses.map((exp: any) => ({
        ...exp,
        dueDate: new Date(exp.dueDate),
        paidDate: exp.paidDate ? new Date(exp.paidDate) : undefined,
        createdAt: new Date(exp.createdAt),
      }));
    }
  } catch (error) {
    console.error('Load from local storage error:', error);
  }
  return [];
};

// Add a new pending expense (bill or debt)
export const addPendingExpense = async (pendingExpense: Omit<PendingExpense, 'userId' | 'createdAt' | 'isPaid'>) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    const expenseId = Crypto.randomUUID();
    
    const expenseData: PendingExpense = {
      id: expenseId,
      title: pendingExpense.title,
      amount: pendingExpense.amount,
      dueDate: pendingExpense.dueDate,
      description: pendingExpense.description || '',
      category: pendingExpense.category,
      type: pendingExpense.type || 'bill',
      isPaid: false,
      userId: userId,
      createdAt: new Date(),
      synced: false,
    };
    
    // Save to local storage first
    const existingExpenses = await loadFromLocalStorage(userId);
    existingExpenses.unshift(expenseData);
    await saveToLocalStorage(userId, existingExpenses);
    console.log('Pending expense saved locally:', expenseData.title);
    
    // Try to sync to Firebase if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      try {
        const firebaseData = {
          title: expenseData.title,
          amount: expenseData.amount,
          dueDate: Timestamp.fromDate(expenseData.dueDate),
          description: expenseData.description || '',
          category: expenseData.category,
          type: expenseData.type,
          isPaid: false,
          userId: userId,
          createdAt: Timestamp.now()
        };
        
        const docRef = await addDoc(collection(db, 'pendingExpenses'), firebaseData);
        
        // Update local record with firebaseId and mark as synced
        expenseData.firebaseId = docRef.id;
        expenseData.synced = true;
        const updatedExpenses = await loadFromLocalStorage(userId);
        const index = updatedExpenses.findIndex(e => e.id === expenseId);
        if (index !== -1) {
          updatedExpenses[index] = expenseData;
          await saveToLocalStorage(userId, updatedExpenses);
        }
        console.log('Pending expense synced to Firebase');
      } catch (firebaseError) {
        console.log('Firebase sync failed, will retry later');
      }
    }
    
    return { success: true, id: expenseId };
  } catch (error: any) {
    console.error('Add pending expense error:', error);
    return { success: false, error: error.message };
  }
};

// Get all pending expenses for current user
export const getPendingExpenses = async (): Promise<PendingExpense[]> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    
    // Try to load from local storage first
    const localExpenses = await loadFromLocalStorage(userId);
    if (localExpenses.length > 0) {
      console.log('Returning pending expenses from local storage:', localExpenses.length);
      return localExpenses;
    }
    
    // If no local data, fetch from Firebase
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return [];
    }
    
    const q = query(
      collection(db, 'pendingExpenses'), 
      where('userId', '==', userId),
      orderBy('dueDate', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const pendingExpenses: PendingExpense[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      pendingExpenses.push({
        id: doc.id,
        firebaseId: doc.id,
        title: data.title,
        amount: data.amount,
        dueDate: data.dueDate.toDate(),
        description: data.description || '',
        category: data.category,
        type: data.type || 'bill',
        isPaid: data.isPaid,
        paidDate: data.paidDate ? data.paidDate.toDate() : undefined,
        paymentMethod: data.paymentMethod,
        userId: data.userId,
        createdAt: data.createdAt.toDate(),
        synced: true,
      });
    });
    
    // Save to local storage for offline use
    await saveToLocalStorage(userId, pendingExpenses);
    
    return pendingExpenses;
  } catch (error) {
    console.error('Get pending expenses error:', error);
    return [];
  }
};

// Get bills only
export const getBills = async (): Promise<PendingExpense[]> => {
  const expenses = await getPendingExpenses();
  return expenses.filter(exp => exp.type === 'bill' && !exp.isPaid);
};

// Get debts only
export const getDebts = async (): Promise<PendingExpense[]> => {
  const expenses = await getPendingExpenses();
  return expenses.filter(exp => exp.type === 'debt' && !exp.isPaid);
};

// Mark as paid
export const markAsPaid = async (expenseId: string, paymentMethod: string) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    // Update local storage
    const localExpenses = await loadFromLocalStorage(userId);
    const expenseIndex = localExpenses.findIndex(e => e.id === expenseId);
    
    if (expenseIndex !== -1) {
      localExpenses[expenseIndex].isPaid = true;
      localExpenses[expenseIndex].paidDate = new Date();
      localExpenses[expenseIndex].paymentMethod = paymentMethod;
      localExpenses[expenseIndex].synced = false;
      await saveToLocalStorage(userId, localExpenses);
    }
    
    // Try to update Firebase if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      const expenseRef = doc(db, 'pendingExpenses', expenseId);
      await updateDoc(expenseRef, {
        isPaid: true,
        paidDate: Timestamp.now(),
        paymentMethod: paymentMethod
      });
      
      // Mark as synced
      if (expenseIndex !== -1) {
        localExpenses[expenseIndex].synced = true;
        await saveToLocalStorage(userId, localExpenses);
      }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Mark as paid error:', error);
    return { success: false, error: error.message };
  }
};

// Delete a pending expense
export const deletePendingExpense = async (expenseId: string) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    // Delete from local storage
    const localExpenses = await loadFromLocalStorage(userId);
    const filtered = localExpenses.filter(e => e.id !== expenseId);
    await saveToLocalStorage(userId, filtered);
    
    // Try to delete from Firebase if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      await deleteDoc(doc(db, 'pendingExpenses', expenseId));
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Delete pending expense error:', error);
    return { success: false, error: error.message };
  }
};

// Update a pending expense
export const updatePendingExpense = async (expenseId: string, updates: Partial<PendingExpense>) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    // Update local storage
    const localExpenses = await loadFromLocalStorage(userId);
    const expenseIndex = localExpenses.findIndex(e => e.id === expenseId);
    
    if (expenseIndex !== -1) {
      localExpenses[expenseIndex] = { ...localExpenses[expenseIndex], ...updates, synced: false };
      await saveToLocalStorage(userId, localExpenses);
    }
    
    // Try to update Firebase if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      const expenseRef = doc(db, 'pendingExpenses', expenseId);
      const updateData: any = {};
      
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.dueDate !== undefined) updateData.dueDate = Timestamp.fromDate(updates.dueDate);
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.type !== undefined) updateData.type = updates.type;
      
      await updateDoc(expenseRef, updateData);
      
      // Mark as synced
      if (expenseIndex !== -1) {
        localExpenses[expenseIndex].synced = true;
        await saveToLocalStorage(userId, localExpenses);
      }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Update pending expense error:', error);
    return { success: false, error: error.message };
  }
};

// Sync all unsynced pending expenses
export const syncPendingExpenses = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return { success: false, error: 'No user logged in' };
    
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return { success: false, error: 'No internet' };
    }
    
    const localExpenses = await loadFromLocalStorage(userId);
    const unsynced = localExpenses.filter(e => !e.synced);
    
    for (const expense of unsynced) {
      try {
        if (!expense.firebaseId) {
          const firebaseData = {
            title: expense.title,
            amount: expense.amount,
            dueDate: Timestamp.fromDate(expense.dueDate),
            description: expense.description || '',
            category: expense.category,
            type: expense.type,
            isPaid: expense.isPaid,
            userId: userId,
            createdAt: Timestamp.now()
          };
          
          const docRef = await addDoc(collection(db, 'pendingExpenses'), firebaseData);
          expense.firebaseId = docRef.id;
          expense.synced = true;
        } else {
          const expenseRef = doc(db, 'pendingExpenses', expense.firebaseId);
          await updateDoc(expenseRef, {
            title: expense.title,
            amount: expense.amount,
            dueDate: Timestamp.fromDate(expense.dueDate),
            description: expense.description || '',
            category: expense.category,
            type: expense.type,
            isPaid: expense.isPaid,
            paidDate: expense.paidDate ? Timestamp.fromDate(expense.paidDate) : null,
            paymentMethod: expense.paymentMethod,
          });
          expense.synced = true;
        }
      } catch (error) {
        console.error('Sync pending expense failed:', expense.id, error);
      }
    }
    
    await saveToLocalStorage(userId, localExpenses);
    return { success: true, syncedCount: unsynced.length };
  } catch (error) {
    console.error('Sync pending expenses error:', error);
    return { success: false, error };
  }
};

// Get total pending amount by type
export const getTotalPendingByType = async (type: 'bill' | 'debt'): Promise<number> => {
  try {
    const expenses = await getPendingExpenses();
    const filteredExpenses = expenses.filter(exp => exp.type === type && !exp.isPaid);
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  } catch (error) {
    console.error('Get total pending amount error:', error);
    return 0;
  }
};