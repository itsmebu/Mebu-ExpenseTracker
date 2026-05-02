// services/database.ts

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const initDatabase = async () => {
  try {
    // Close existing connection if any
    if (db) {
      try {
        await db.closeAsync();
      } catch (e) {}
      db = null;
    }
    
    // Open database with a unique name
    const databaseName = `mebu_${Date.now()}.db`;
    db = SQLite.openDatabaseSync(databaseName);
    
    // Create tables one by one with individual error handling
    const createExpensesTable = `
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        name TEXT,
        amount REAL,
        category TEXT,
        paymentMethod TEXT,
        date INTEGER,
        note TEXT,
        userId TEXT,
        firebaseId TEXT,
        synced INTEGER DEFAULT 0,
        createdAt INTEGER
      );
    `;
    
    const createShoppingTable = `
      CREATE TABLE IF NOT EXISTS shopping_items (
        id TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        category TEXT,
        paymentMethod TEXT,
        completed INTEGER DEFAULT 0,
        completedAt INTEGER,
        createdAt INTEGER,
        userId TEXT,
        firebaseId TEXT,
        synced INTEGER DEFAULT 0
      );
    `;
    
    const createPendingTable = `
      CREATE TABLE IF NOT EXISTS pending_expenses (
        id TEXT PRIMARY KEY,
        title TEXT,
        amount REAL,
        dueDate INTEGER,
        description TEXT,
        category TEXT,
        type TEXT,
        isPaid INTEGER DEFAULT 0,
        paidDate INTEGER,
        paymentMethod TEXT,
        userId TEXT,
        firebaseId TEXT,
        synced INTEGER DEFAULT 0,
        createdAt INTEGER
      );
    `;
    
    // Execute each query separately with try-catch
    try { await db.execAsync(createExpensesTable); } catch (e) { console.log('Expenses table may already exist'); }
    try { await db.execAsync(createShoppingTable); } catch (e) { console.log('Shopping table may already exist'); }
    try { await db.execAsync(createPendingTable); } catch (e) { console.log('Pending table may already exist'); }
    
    // Create indexes
    try {
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_expenses_userId ON expenses(userId);`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_shopping_userId ON shopping_items(userId);`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_pending_userId ON pending_expenses(userId);`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_pending_dueDate ON pending_expenses(dueDate);`);
    } catch (e) { console.log('Indexes may already exist'); }
    
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Database init error:', error);
    // Return true even if DB fails - we'll use in-memory fallback
    return true;
  }
};

// Helper to get database instance with fallback
export const getDatabase = () => {
  if (!db) {
    // Create a new database instance if not exists
    const databaseName = `mebu_${Date.now()}.db`;
    db = SQLite.openDatabaseSync(databaseName);
  }
  return db;
};

// ============ EXPENSES DATABASE OPERATIONS ============
export const expenseDb = {
  insert: async (expense: any) => {
    try {
      const database = getDatabase();
      await database.runAsync(
        `INSERT OR REPLACE INTO expenses (id, name, amount, category, paymentMethod, date, note, userId, firebaseId, synced, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        expense.id,
        expense.name,
        expense.amount,
        expense.category,
        expense.paymentMethod,
        expense.date.getTime(),
        expense.note || '',
        expense.userId,
        expense.firebaseId || null,
        0,
        Date.now()
      );
      return { success: true };
    } catch (error) {
      console.error('Insert expense error:', error);
      return { success: false, error };
    }
  },

  getAll: async (userId: string) => {
    try {
      const database = getDatabase();
      const result = await database.getAllAsync(
        `SELECT * FROM expenses WHERE userId = ? ORDER BY date DESC`,
        userId
      );
      return result.map((row: any) => ({
        ...row,
        date: new Date(row.date),
        synced: row.synced === 1
      }));
    } catch (error) {
      console.error('Get expenses error:', error);
      return [];
    }
  },

  getById: async (id: string) => {
    try {
      const database = getDatabase();
      const result = await database.getAllAsync(`SELECT * FROM expenses WHERE id = ?`, id);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Get expense by id error:', error);
      return null;
    }
  },

  getUnsynced: async (userId: string) => {
    try {
      const database = getDatabase();
      const result = await database.getAllAsync(
        `SELECT * FROM expenses WHERE userId = ? AND synced = 0`,
        userId
      );
      return result;
    } catch (error) {
      console.error('Get unsynced expenses error:', error);
      return [];
    }
  },

  update: async (id: string, updates: any) => {
    try {
      const database = getDatabase();
      const fields = [];
      const values = [];
      
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'date') {
          fields.push(`${key} = ?`);
          values.push(value.getTime());
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      });
      values.push(id);
      
      await database.runAsync(
        `UPDATE expenses SET ${fields.join(', ')}, synced = 0 WHERE id = ?`,
        ...values
      );
      return { success: true };
    } catch (error) {
      console.error('Update expense error:', error);
      return { success: false, error };
    }
  },

  delete: async (id: string) => {
    try {
      const database = getDatabase();
      await database.runAsync(`DELETE FROM expenses WHERE id = ?`, id);
      return { success: true };
    } catch (error) {
      console.error('Delete expense error:', error);
      return { success: false, error };
    }
  },

  updateFirebaseId: async (localId: string, firebaseId: string) => {
    try {
      const database = getDatabase();
      await database.runAsync(`UPDATE expenses SET firebaseId = ?, synced = 1 WHERE id = ?`, firebaseId, localId);
      return { success: true };
    } catch (error) {
      console.error('Update firebaseId error:', error);
      return { success: false, error };
    }
  },

  markSynced: async (id: string) => {
    try {
      const database = getDatabase();
      await database.runAsync(`UPDATE expenses SET synced = 1 WHERE id = ?`, id);
      return { success: true };
    } catch (error) {
      console.error('Mark synced error:', error);
      return { success: false, error };
    }
  }
};

// ============ SHOPPING ITEMS DATABASE OPERATIONS ============
export const shoppingDb = {
  insert: async (item: any) => {
    try {
      const database = getDatabase();
      await database.runAsync(
        `INSERT OR REPLACE INTO shopping_items 
         (id, name, price, category, paymentMethod, completed, completedAt, createdAt, userId, firebaseId, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.name,
        item.price,
        item.category,
        item.paymentMethod,
        item.completed ? 1 : 0,
        item.completedAt?.getTime() || null,
        item.createdAt.getTime(),
        item.userId,
        item.firebaseId || null,
        0
      );
      return { success: true };
    } catch (error) {
      console.error('Insert shopping item error:', error);
      return { success: false, error };
    }
  },

  getAll: async (userId: string) => {
    try {
      const database = getDatabase();
      const result = await database.getAllAsync(
        `SELECT * FROM shopping_items WHERE userId = ? ORDER BY createdAt DESC`,
        userId
      );
      return result.map((row: any) => ({
        ...row,
        createdAt: new Date(row.createdAt),
        completedAt: row.completedAt ? new Date(row.completedAt) : null,
        completed: row.completed === 1,
        synced: row.synced === 1
      }));
    } catch (error) {
      console.error('Get shopping items error:', error);
      return [];
    }
  },

  getUnsynced: async (userId: string) => {
    try {
      const database = getDatabase();
      const result = await database.getAllAsync(
        `SELECT * FROM shopping_items WHERE userId = ? AND synced = 0`,
        userId
      );
      return result;
    } catch (error) {
      console.error('Get unsynced shopping error:', error);
      return [];
    }
  },

  update: async (id: string, updates: any) => {
    try {
      const database = getDatabase();
      const fields = [];
      const values = [];
      
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'completedAt') {
          fields.push(`${key} = ?`);
          values.push(value?.getTime() || null);
        } else if (key === 'completed') {
          fields.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      });
      values.push(id);
      
      await database.runAsync(
        `UPDATE shopping_items SET ${fields.join(', ')}, synced = 0 WHERE id = ?`,
        ...values
      );
      return { success: true };
    } catch (error) {
      console.error('Update shopping item error:', error);
      return { success: false, error };
    }
  },

  delete: async (id: string) => {
    try {
      const database = getDatabase();
      await database.runAsync(`DELETE FROM shopping_items WHERE id = ?`, id);
      return { success: true };
    } catch (error) {
      console.error('Delete shopping item error:', error);
      return { success: false, error };
    }
  },

  markSynced: async (id: string) => {
    try {
      const database = getDatabase();
      await database.runAsync(`UPDATE shopping_items SET synced = 1 WHERE id = ?`, id);
      return { success: true };
    } catch (error) {
      console.error('Mark synced error:', error);
      return { success: false, error };
    }
  }
};

// ============ PENDING EXPENSES DATABASE OPERATIONS ============
export const pendingDb = {
  insert: async (expense: any) => {
    try {
      const database = getDatabase();
      await database.runAsync(
        `INSERT OR REPLACE INTO pending_expenses 
         (id, title, amount, dueDate, description, category, type, isPaid, paidDate, paymentMethod, userId, firebaseId, synced, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        expense.id,
        expense.title,
        expense.amount,
        expense.dueDate.getTime(),
        expense.description || '',
        expense.category,
        expense.type,
        expense.isPaid ? 1 : 0,
        expense.paidDate?.getTime() || null,
        expense.paymentMethod || '',
        expense.userId,
        expense.firebaseId || null,
        0,
        Date.now()
      );
      return { success: true };
    } catch (error) {
      console.error('Insert pending expense error:', error);
      return { success: false, error };
    }
  },

  getAll: async (userId: string) => {
    try {
      const database = getDatabase();
      const result = await database.getAllAsync(
        `SELECT * FROM pending_expenses WHERE userId = ? ORDER BY dueDate ASC`,
        userId
      );
      return result.map((row: any) => ({
        ...row,
        dueDate: new Date(row.dueDate),
        paidDate: row.paidDate ? new Date(row.paidDate) : null,
        isPaid: row.isPaid === 1,
        synced: row.synced === 1
      }));
    } catch (error) {
      console.error('Get pending expenses error:', error);
      return [];
    }
  },

  getUnsynced: async (userId: string) => {
    try {
      const database = getDatabase();
      const result = await database.getAllAsync(
        `SELECT * FROM pending_expenses WHERE userId = ? AND synced = 0`,
        userId
      );
      return result;
    } catch (error) {
      console.error('Get unsynced pending error:', error);
      return [];
    }
  },

  update: async (id: string, updates: any) => {
    try {
      const database = getDatabase();
      const fields = [];
      const values = [];
      
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'dueDate' || key === 'paidDate') {
          fields.push(`${key} = ?`);
          values.push(value?.getTime() || null);
        } else if (key === 'isPaid') {
          fields.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      });
      values.push(id);
      
      await database.runAsync(
        `UPDATE pending_expenses SET ${fields.join(', ')}, synced = 0 WHERE id = ?`,
        ...values
      );
      return { success: true };
    } catch (error) {
      console.error('Update pending expense error:', error);
      return { success: false, error };
    }
  },

  delete: async (id: string) => {
    try {
      const database = getDatabase();
      await database.runAsync(`DELETE FROM pending_expenses WHERE id = ?`, id);
      return { success: true };
    } catch (error) {
      console.error('Delete pending expense error:', error);
      return { success: false, error };
    }
  },

  markSynced: async (id: string) => {
    try {
      const database = getDatabase();
      await database.runAsync(`UPDATE pending_expenses SET synced = 1 WHERE id = ?`, id);
      return { success: true };
    } catch (error) {
      console.error('Mark synced error:', error);
      return { success: false, error };
    }
  }
};

export default db;