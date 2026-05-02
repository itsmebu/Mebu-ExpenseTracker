// store/expenses.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { Timestamp, addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface Expense {
  id?: string;
  name?: string;
  amount: number;
  category: string;
  date: Date;
  note?: string;
  paymentMethod?: string;
  userId: string;
  firebaseId?: string;
  synced?: boolean;
}

export interface Category {
  id?: string;
  name: string;
  userId: string;
}

const STORAGE_KEYS = {
  EXPENSES: '@mebu/expenses',
  SHOPPING: '@mebu/shopping',
  PENDING: '@mebu/pending',
  CATEGORIES: '@mebu/categories',
};

// Default categories
const DEFAULT_CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Bills', 
  'Entertainment', 'Health', 'Education', 'Other'
];

// Helper to generate ID
export const generateId = () => Crypto.randomUUID();

// Debug storage function
export const debugStorage = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log('No user logged in');
      return;
    }
    
    const key = `${STORAGE_KEYS.EXPENSES}_${userId}`;
    const data = await AsyncStorage.getItem(key);
    console.log('=== DEBUG STORAGE ===');
    console.log('Storage key:', key);
    console.log('Data in storage:', data ? JSON.parse(data).length : 'No data');
    if (data) {
      const expenses = JSON.parse(data);
      console.log('Total expenses:', expenses.length);
      if (expenses.length > 0) {
        console.log('First expense:', expenses[0]);
      }
    }
  } catch (error) {
    console.error('Debug storage error:', error);
  }
};

// ============ EXPENSES STORAGE FUNCTIONS ============
export const expenseStorage = {
  getKey: (userId: string) => `${STORAGE_KEYS.EXPENSES}_${userId}`,
  
  getAll: async (userId: string): Promise<Expense[]> => {
    try {
      const key = `${STORAGE_KEYS.EXPENSES}_${userId}`;
      const data = await AsyncStorage.getItem(key);
      if (!data) return [];
      const expenses = JSON.parse(data);
      return expenses.map((exp: any) => ({
        ...exp,
        date: new Date(exp.date),
      }));
    } catch (error) {
      console.error('Get expenses error:', error);
      return [];
    }
  },

  saveAll: async (userId: string, expenses: Expense[]) => {
    try {
      const key = `${STORAGE_KEYS.EXPENSES}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(expenses));
      console.log(`Saved ${expenses.length} expenses to storage`);
      return true;
    } catch (error) {
      console.error('Save expenses error:', error);
      return false;
    }
  },

  add: async (userId: string, expense: Expense) => {
    const expenses = await expenseStorage.getAll(userId);
    expenses.unshift(expense);
    await expenseStorage.saveAll(userId, expenses);
    return true;
  },

  update: async (userId: string, expenseId: string, updates: any) => {
    const expenses = await expenseStorage.getAll(userId);
    const index = expenses.findIndex((e: any) => e.id === expenseId);
    if (index !== -1) {
      expenses[index] = { ...expenses[index], ...updates };
      await expenseStorage.saveAll(userId, expenses);
    }
    return true;
  },

  delete: async (userId: string, expenseId: string) => {
    const expenses = await expenseStorage.getAll(userId);
    const filtered = expenses.filter((e: any) => e.id !== expenseId);
    await expenseStorage.saveAll(userId, filtered);
    return true;
  },
};

// Initialize default categories in Firebase
export const initializeDefaultCategories = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return { success: false, error: 'No user logged in' };
    
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return { success: false, error: 'No internet connection' };
    }
    
    const q = query(collection(db, 'categories'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    if (snapshot.size > 0) {
      console.log('Categories already exist:', snapshot.size);
      return { success: true };
    }
    
    for (const cat of DEFAULT_CATEGORIES) {
      await addDoc(collection(db, 'categories'), {
        name: cat,
        userId: userId,
        createdAt: Timestamp.now()
      });
    }
    
    console.log('Created default categories');
    return { success: true };
  } catch (error) {
    console.error('Initialize categories error:', error);
    return { success: false, error };
  }
};

// Load initial data from Firebase to local storage
export const loadInitialData = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log('No user logged in');
      return false;
    }
    
    console.log('=== LOADING INITIAL DATA ===');
    console.log('User ID:', userId);
    
    // Check if we have local data
    const localExpenses = await expenseStorage.getAll(userId);
    console.log('Local expenses found:', localExpenses.length);
    
    if (localExpenses.length > 0) {
      console.log('Using existing local data');
      return true;
    }
    
    // Check network
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('Offline and no local data');
      return false;
    }
    
    // Load from Firebase
    console.log('Loading from Firebase...');
    const expensesQuery = query(collection(db, 'expenses'), where('userId', '==', userId));
    const expensesSnapshot = await getDocs(expensesQuery);
    
    console.log(`Found ${expensesSnapshot.size} expenses in Firebase`);
    
    const expensesToSave = [];
    for (const doc of expensesSnapshot.docs) {
      const data = doc.data();
      expensesToSave.push({
        id: generateId(),
        firebaseId: doc.id,
        name: data.name || `${data.category} Expense`,
        amount: data.amount,
        category: data.category,
        paymentMethod: data.paymentMethod || 'cash',
        date: data.date.toDate(),
        note: data.note || '',
        userId: userId,
        synced: true,
      });
    }
    
    if (expensesToSave.length > 0) {
      await expenseStorage.saveAll(userId, expensesToSave);
      console.log(`Saved ${expensesToSave.length} expenses to local storage`);
    }
    
    // Initialize categories
    await initializeDefaultCategories();
    
    return true;
  } catch (error) {
    console.error('Load initial data error:', error);
    return false;
  }
};

// Add a new expense
export const addExpense = async (expense: Omit<Expense, 'userId'>) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    const expenseId = generateId();
    
    const expenseData: Expense = {
      id: expenseId,
      name: expense.name || `${expense.category} Expense`,
      amount: expense.amount,
      category: expense.category,
      paymentMethod: expense.paymentMethod || 'cash',
      date: expense.date,
      note: expense.note || '',
      userId: userId,
      synced: false,
    };
    
    // Save locally
    await expenseStorage.add(userId, expenseData);
    console.log('Expense saved locally:', expenseData.name);
    
    // Try to sync to Firebase
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      try {
        const firebaseData = {
          name: expenseData.name,
          amount: expenseData.amount,
          category: expenseData.category,
          paymentMethod: expenseData.paymentMethod,
          date: Timestamp.fromDate(expenseData.date),
          note: expenseData.note,
          userId: userId,
          createdAt: Timestamp.now(),
        };
        
        const docRef = await addDoc(collection(db, 'expenses'), firebaseData);
        await expenseStorage.update(userId, expenseId, { firebaseId: docRef.id, synced: true });
        console.log('Expense synced to Firebase:', docRef.id);
      } catch (firebaseError) {
        console.log('Firebase sync failed, will retry later');
      }
    }
    
    return { success: true, id: expenseId };
  } catch (error: any) {
    console.error('Add expense error:', error);
    return { success: false, error: error.message };
  }
};

// Get all expenses
export const getExpenses = async (): Promise<Expense[]> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    
    const expenses = await expenseStorage.getAll(userId);
    console.log('Returning expenses from storage:', expenses.length);
    return expenses;
  } catch (error) {
    console.error('Get expenses error:', error);
    return [];
  }
};

// Get expenses by month
export const getExpensesByMonth = async (year: number, month: number): Promise<Expense[]> => {
  try {
    const allExpenses = await getExpenses();
    return allExpenses.filter(exp => {
      return exp.date.getFullYear() === year && exp.date.getMonth() === month;
    });
  } catch (error) {
    console.error('Get expenses by month error:', error);
    return [];
  }
};

// Update an expense
export const updateExpense = async (expenseId: string, updates: Partial<Expense>) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    await expenseStorage.update(userId, expenseId, { ...updates, synced: false });
    
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      const expenses = await expenseStorage.getAll(userId);
      const expense = expenses.find((e: any) => e.id === expenseId);
      if (expense && expense.firebaseId) {
        try {
          const expenseRef = doc(db, 'expenses', expense.firebaseId);
          const firebaseUpdates: any = { ...updates };
          if (updates.date) firebaseUpdates.date = Timestamp.fromDate(updates.date);
          await updateDoc(expenseRef, firebaseUpdates);
          await expenseStorage.update(userId, expenseId, { synced: true });
        } catch (firebaseError) {
          console.log('Firebase update failed');
        }
      }
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Delete an expense
export const deleteExpense = async (expenseId: string) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    const expenses = await expenseStorage.getAll(userId);
    const expense = expenses.find((e: any) => e.id === expenseId);
    
    await expenseStorage.delete(userId, expenseId);
    
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && expense && expense.firebaseId) {
      try {
        await deleteDoc(doc(db, 'expenses', expense.firebaseId));
      } catch (firebaseError) {
        console.log('Firebase delete failed');
      }
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Sync all unsynced expenses
export const syncExpenses = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return { success: false, error: 'No user logged in' };
    
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return { success: false, error: 'No internet' };
    }
    
    const expenses = await expenseStorage.getAll(userId);
    const unsynced = expenses.filter((e: any) => !e.synced);
    
    console.log(`Syncing ${unsynced.length} unsynced expenses`);
    
    for (const expense of unsynced) {
      try {
        if (!expense.firebaseId) {
          const firebaseData = {
            name: expense.name,
            amount: expense.amount,
            category: expense.category,
            paymentMethod: expense.paymentMethod,
            date: Timestamp.fromDate(new Date(expense.date)),
            note: expense.note,
            userId: userId,
            createdAt: Timestamp.now(),
          };
          const docRef = await addDoc(collection(db, 'expenses'), firebaseData);
          await expenseStorage.update(userId, expense.id, { firebaseId: docRef.id, synced: true });
          console.log('Synced new expense:', expense.name);
        } else {
          const expenseRef = doc(db, 'expenses', expense.firebaseId);
          await updateDoc(expenseRef, {
            name: expense.name,
            amount: expense.amount,
            category: expense.category,
            paymentMethod: expense.paymentMethod,
            date: Timestamp.fromDate(new Date(expense.date)),
            note: expense.note,
          });
          await expenseStorage.update(userId, expense.id, { synced: true });
          console.log('Synced updated expense:', expense.name);
        }
      } catch (error) {
        console.error('Sync expense failed:', expense.id, error);
      }
    }
    
    return { success: true, syncedCount: unsynced.length };
  } catch (error) {
    console.error('Sync expenses error:', error);
    return { success: false, error };
  }
};

// ============ CATEGORY FUNCTIONS ============
export const getCategories = async (): Promise<Category[]> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    
    // Try cache first
    const cached = await AsyncStorage.getItem(`${STORAGE_KEYS.CATEGORIES}_${userId}`);
    if (cached) {
      const categories = JSON.parse(cached);
      if (categories.length > 0) {
        return categories;
      }
    }
    
    // Check network
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return DEFAULT_CATEGORIES.map((name, index) => ({
        id: index.toString(),
        name: name,
        userId: userId
      }));
    }
    
    // Fetch from Firebase
    const q = query(collection(db, 'categories'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const categories: Category[] = [];
    
    querySnapshot.forEach((doc) => {
      categories.push({
        id: doc.id,
        name: doc.data().name,
        userId: doc.data().userId
      });
    });
    
    if (categories.length === 0) {
      // Create default categories
      for (const cat of DEFAULT_CATEGORIES) {
        await addDoc(collection(db, 'categories'), {
          name: cat,
          userId: userId,
          createdAt: Timestamp.now()
        });
      }
      
      // Fetch again
      const newSnapshot = await getDocs(q);
      const newCategories: Category[] = [];
      newSnapshot.forEach((doc) => {
        newCategories.push({
          id: doc.id,
          name: doc.data().name,
          userId: doc.data().userId
        });
      });
      
      await AsyncStorage.setItem(`${STORAGE_KEYS.CATEGORIES}_${userId}`, JSON.stringify(newCategories));
      return newCategories;
    }
    
    await AsyncStorage.setItem(`${STORAGE_KEYS.CATEGORIES}_${userId}`, JSON.stringify(categories));
    return categories;
  } catch (error) {
    console.error('Get categories error:', error);
    const userId = auth.currentUser?.uid;
    if (userId) {
      const cached = await AsyncStorage.getItem(`${STORAGE_KEYS.CATEGORIES}_${userId}`);
      if (cached) return JSON.parse(cached);
    }
    return DEFAULT_CATEGORIES.map((name, index) => ({
      id: index.toString(),
      name: name,
      userId: userId || ''
    }));
  }
};

export const addCategory = async (categoryName: string) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return { success: false, error: 'No internet connection' };
    }
    
    const q = query(collection(db, 'categories'), where('userId', '==', userId), where('name', '==', categoryName));
    const existing = await getDocs(q);
    
    if (!existing.empty) {
      return { success: false, error: 'Category already exists' };
    }
    
    const docRef = await addDoc(collection(db, 'categories'), {
      name: categoryName,
      userId,
      createdAt: Timestamp.now()
    });
    
    await AsyncStorage.removeItem(`${STORAGE_KEYS.CATEGORIES}_${userId}`);
    
    return { success: true, id: docRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateCategory = async (categoryId: string, newName: string) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    const categoryRef = doc(db, 'categories', categoryId);
    await updateDoc(categoryRef, { name: newName });
    
    await AsyncStorage.removeItem(`${STORAGE_KEYS.CATEGORIES}_${userId}`);
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const deleteCategory = async (categoryId: string) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('No user logged in');
    
    await deleteDoc(doc(db, 'categories', categoryId));
    
    await AsyncStorage.removeItem(`${STORAGE_KEYS.CATEGORIES}_${userId}`);
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};