// services/storage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const STORAGE_KEYS = {
  EXPENSES: '@mebu/expenses',
  SHOPPING: '@mebu/shopping',
  PENDING: '@mebu/pending',
  SYNC_QUEUE: '@mebu/sync_queue',
};

// Helper to generate unique ID
export const generateId = () => Crypto.randomUUID();

// ============ EXPENSES STORAGE ============
export const expenseStorage = {
  // Save all expenses
  saveAll: async (userId: string, expenses: any[]) => {
    try {
      const key = `${STORAGE_KEYS.EXPENSES}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(expenses));
      return { success: true };
    } catch (error) {
      console.error('Save expenses error:', error);
      return { success: false };
    }
  },

  // Get all expenses
  getAll: async (userId: string) => {
    try {
      const key = `${STORAGE_KEYS.EXPENSES}_${userId}`;
      const data = await AsyncStorage.getItem(key);
      if (!data) return [];
      
      const expenses = JSON.parse(data);
      // Convert date strings back to Date objects
      return expenses.map((exp: any) => ({
        ...exp,
        date: new Date(exp.date),
      }));
    } catch (error) {
      console.error('Get expenses error:', error);
      return [];
    }
  },

  // Add a single expense
  add: async (userId: string, expense: any) => {
    try {
      const expenses = await expenseStorage.getAll(userId);
      expenses.unshift(expense);
      await expenseStorage.saveAll(userId, expenses);
      return { success: true };
    } catch (error) {
      console.error('Add expense error:', error);
      return { success: false };
    }
  },

  // Update an expense
  update: async (userId: string, expenseId: string, updates: any) => {
    try {
      const expenses = await expenseStorage.getAll(userId);
      const index = expenses.findIndex((e: any) => e.id === expenseId);
      if (index !== -1) {
        expenses[index] = { ...expenses[index], ...updates };
        await expenseStorage.saveAll(userId, expenses);
      }
      return { success: true };
    } catch (error) {
      console.error('Update expense error:', error);
      return { success: false };
    }
  },

  // Delete an expense
  delete: async (userId: string, expenseId: string) => {
    try {
      const expenses = await expenseStorage.getAll(userId);
      const filtered = expenses.filter((e: any) => e.id !== expenseId);
      await expenseStorage.saveAll(userId, filtered);
      return { success: true };
    } catch (error) {
      console.error('Delete expense error:', error);
      return { success: false };
    }
  },
};

// ============ SHOPPING STORAGE ============
export const shoppingStorage = {
  saveAll: async (userId: string, items: any[]) => {
    try {
      const key = `${STORAGE_KEYS.SHOPPING}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(items));
      return { success: true };
    } catch (error) {
      console.error('Save shopping error:', error);
      return { success: false };
    }
  },

  getAll: async (userId: string) => {
    try {
      const key = `${STORAGE_KEYS.SHOPPING}_${userId}`;
      const data = await AsyncStorage.getItem(key);
      if (!data) return [];
      
      const items = JSON.parse(data);
      return items.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        completedAt: item.completedAt ? new Date(item.completedAt) : null,
      }));
    } catch (error) {
      console.error('Get shopping error:', error);
      return [];
    }
  },

  add: async (userId: string, item: any) => {
    try {
      const items = await shoppingStorage.getAll(userId);
      items.unshift(item);
      await shoppingStorage.saveAll(userId, items);
      return { success: true };
    } catch (error) {
      console.error('Add shopping error:', error);
      return { success: false };
    }
  },

  update: async (userId: string, itemId: string, updates: any) => {
    try {
      const items = await shoppingStorage.getAll(userId);
      const index = items.findIndex((i: any) => i.id === itemId);
      if (index !== -1) {
        items[index] = { ...items[index], ...updates };
        await shoppingStorage.saveAll(userId, items);
      }
      return { success: true };
    } catch (error) {
      console.error('Update shopping error:', error);
      return { success: false };
    }
  },

  delete: async (userId: string, itemId: string) => {
    try {
      const items = await shoppingStorage.getAll(userId);
      const filtered = items.filter((i: any) => i.id !== itemId);
      await shoppingStorage.saveAll(userId, filtered);
      return { success: true };
    } catch (error) {
      console.error('Delete shopping error:', error);
      return { success: false };
    }
  },
};

// ============ PENDING EXPENSES STORAGE ============
export const pendingStorage = {
  saveAll: async (userId: string, expenses: any[]) => {
    try {
      const key = `${STORAGE_KEYS.PENDING}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(expenses));
      return { success: true };
    } catch (error) {
      console.error('Save pending error:', error);
      return { success: false };
    }
  },

  getAll: async (userId: string) => {
    try {
      const key = `${STORAGE_KEYS.PENDING}_${userId}`;
      const data = await AsyncStorage.getItem(key);
      if (!data) return [];
      
      const expenses = JSON.parse(data);
      return expenses.map((exp: any) => ({
        ...exp,
        dueDate: new Date(exp.dueDate),
        paidDate: exp.paidDate ? new Date(exp.paidDate) : null,
      }));
    } catch (error) {
      console.error('Get pending error:', error);
      return [];
    }
  },

  add: async (userId: string, expense: any) => {
    try {
      const expenses = await pendingStorage.getAll(userId);
      expenses.unshift(expense);
      await pendingStorage.saveAll(userId, expenses);
      return { success: true };
    } catch (error) {
      console.error('Add pending error:', error);
      return { success: false };
    }
  },

  update: async (userId: string, expenseId: string, updates: any) => {
    try {
      const expenses = await pendingStorage.getAll(userId);
      const index = expenses.findIndex((e: any) => e.id === expenseId);
      if (index !== -1) {
        expenses[index] = { ...expenses[index], ...updates };
        await pendingStorage.saveAll(userId, expenses);
      }
      return { success: true };
    } catch (error) {
      console.error('Update pending error:', error);
      return { success: false };
    }
  },

  delete: async (userId: string, expenseId: string) => {
    try {
      const expenses = await pendingStorage.getAll(userId);
      const filtered = expenses.filter((e: any) => e.id !== expenseId);
      await pendingStorage.saveAll(userId, filtered);
      return { success: true };
    } catch (error) {
      console.error('Delete pending error:', error);
      return { success: false };
    }
  },
};

export default { expenseStorage, shoppingStorage, pendingStorage };