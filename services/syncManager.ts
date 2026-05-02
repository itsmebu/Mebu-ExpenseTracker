// services/syncManager.ts

import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { addDoc, collection, doc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db as firestore } from '../config/firebase';
import { expenseDb, pendingDb, shoppingDb } from './database';

export class SyncManager {
  private static instance: SyncManager;
  private isSyncing = false;
  private listeners: ((isSyncing: boolean) => void)[] = [];

  static getInstance() {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  addListener(callback: (isSyncing: boolean) => void) {
    this.listeners.push(callback);
  }

  removeListener(callback: (isSyncing: boolean) => void) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb(this.isSyncing));
  }

  // Sync local unsynced data to Firebase
  async syncToFirebase() {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('Offline mode - sync skipped');
      return { success: false, error: 'Offline' };
    }

    if (this.isSyncing) {
      return { success: false, error: 'Sync in progress' };
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        this.isSyncing = false;
        return { success: false, error: 'No user' };
      }

      let syncedCount = 0;

      // Sync expenses
      const unsyncedExpenses = await expenseDb.getUnsynced(userId);
      for (const expense of unsyncedExpenses) {
        try {
          let firebaseId = expense.firebaseId;
          
          if (!firebaseId) {
            // New expense - add to Firebase
            const docRef = await addDoc(collection(firestore, 'expenses'), {
              name: expense.name,
              amount: expense.amount,
              category: expense.category,
              paymentMethod: expense.paymentMethod,
              date: Timestamp.fromDate(new Date(expense.date)),
              note: expense.note,
              userId: userId,
              createdAt: Timestamp.now(),
            });
            firebaseId = docRef.id;
            await expenseDb.updateFirebaseId(expense.id, firebaseId);
          } else {
            // Update existing expense
            const expenseRef = doc(firestore, 'expenses', firebaseId);
            await updateDoc(expenseRef, {
              name: expense.name,
              amount: expense.amount,
              category: expense.category,
              paymentMethod: expense.paymentMethod,
              date: Timestamp.fromDate(new Date(expense.date)),
              note: expense.note,
            });
          }
          await expenseDb.markSynced(expense.id);
          syncedCount++;
        } catch (error) {
          console.error('Sync expense failed:', expense.id, error);
        }
      }

      // Sync shopping items
      const unsyncedShopping = await shoppingDb.getUnsynced(userId);
      for (const item of unsyncedShopping) {
        try {
          let firebaseId = item.firebaseId;
          
          if (!firebaseId) {
            const docRef = await addDoc(collection(firestore, 'shoppingList'), {
              name: item.name,
              price: item.price,
              category: item.category,
              paymentMethod: item.paymentMethod,
              completed: item.completed === 1,
              completedAt: item.completedAt ? Timestamp.fromDate(new Date(item.completedAt)) : null,
              createdAt: Timestamp.fromDate(new Date(item.createdAt)),
              userId: userId,
            });
            // Store firebaseId mapping (you'd need a separate collection for this)
          }
          await shoppingDb.markSynced(item.id);
          syncedCount++;
        } catch (error) {
          console.error('Sync shopping failed:', item.id, error);
        }
      }

      // Sync pending expenses
      const unsyncedPending = await pendingDb.getUnsynced(userId);
      for (const pending of unsyncedPending) {
        try {
          let firebaseId = pending.firebaseId;
          
          if (!firebaseId) {
            await addDoc(collection(firestore, 'pendingExpenses'), {
              title: pending.title,
              amount: pending.amount,
              dueDate: Timestamp.fromDate(new Date(pending.dueDate)),
              description: pending.description,
              category: pending.category,
              type: pending.type,
              isPaid: pending.isPaid === 1,
              paidDate: pending.paidDate ? Timestamp.fromDate(new Date(pending.paidDate)) : null,
              paymentMethod: pending.paymentMethod,
              userId: userId,
              createdAt: Timestamp.now(),
            });
          }
          await pendingDb.markSynced(pending.id);
          syncedCount++;
        } catch (error) {
          console.error('Sync pending failed:', pending.id, error);
        }
      }

      this.isSyncing = false;
      this.notifyListeners();
      return { success: true, synced: syncedCount };
    } catch (error) {
      console.error('Sync error:', error);
      this.isSyncing = false;
      this.notifyListeners();
      return { success: false, error };
    }
  }

  // Load data from Firebase to local (first time or after login)
  async loadFromFirebase() {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('Offline - using cached data');
      return { success: true, loaded: 0 };
    }

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return { success: false, error: 'No user' };
      }

      // Check if local data exists
      const localExpenses = await expenseDb.getAll(userId);
      if (localExpenses.length > 0) {
        console.log('Local data exists, skipping download');
        return { success: true, loaded: 0 };
      }

      let loaded = 0;

      // Load expenses
      const expensesQuery = query(collection(firestore, 'expenses'), where('userId', '==', userId));
      const expensesSnapshot = await getDocs(expensesQuery);
      for (const doc of expensesSnapshot.docs) {
        const data = doc.data();
        await expenseDb.insert({
          id: Crypto.randomUUID(),
          firebaseId: doc.id,
          name: data.name,
          amount: data.amount,
          category: data.category,
          paymentMethod: data.paymentMethod,
          date: data.date.toDate(),
          note: data.note || '',
          userId: userId,
        });
        loaded++;
      }

      // Load shopping items
      const shoppingQuery = query(collection(firestore, 'shoppingList'), where('userId', '==', userId));
      const shoppingSnapshot = await getDocs(shoppingQuery);
      for (const doc of shoppingSnapshot.docs) {
        const data = doc.data();
        await shoppingDb.insert({
          id: Crypto.randomUUID(),
          firebaseId: doc.id,
          name: data.name,
          price: data.price,
          category: data.category,
          paymentMethod: data.paymentMethod,
          completed: data.completed || false,
          completedAt: data.completedAt?.toDate() || null,
          createdAt: data.createdAt.toDate(),
          userId: userId,
        });
        loaded++;
      }

      // Load pending expenses
      const pendingQuery = query(collection(firestore, 'pendingExpenses'), where('userId', '==', userId));
      const pendingSnapshot = await getDocs(pendingQuery);
      for (const doc of pendingSnapshot.docs) {
        const data = doc.data();
        await pendingDb.insert({
          id: Crypto.randomUUID(),
          firebaseId: doc.id,
          title: data.title,
          amount: data.amount,
          dueDate: data.dueDate.toDate(),
          description: data.description || '',
          category: data.category,
          type: data.type || 'bill',
          isPaid: data.isPaid || false,
          paidDate: data.paidDate?.toDate() || null,
          paymentMethod: data.paymentMethod || '',
          userId: userId,
        });
        loaded++;
      }

      console.log(`Loaded ${loaded} records from Firebase`);
      return { success: true, loaded };
    } catch (error) {
      console.error('Load from Firebase error:', error);
      return { success: false, error };
    }
  }

  startAutoSync(intervalMinutes = 5) {
    setInterval(() => {
      this.syncToFirebase();
    }, intervalMinutes * 60 * 1000);
  }
}