// contexts/OfflineContext.tsx

import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { SyncManager } from '../services/syncManager';

interface OfflineContextType {
  isConnected: boolean;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  lastSync: Date | null;
}

const OfflineContext = createContext<OfflineContextType>({
  isConnected: true,
  isSyncing: false,
  syncNow: async () => {},
  lastSync: null,
});

export const useOffline = () => useContext(OfflineContext);

export const OfflineProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const syncManager = SyncManager.getInstance();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? false;
      setIsConnected(connected);
      
      // Auto-sync when connection is restored
      if (connected) {
        syncManager.syncToFirebase();
      }
    });

    syncManager.addListener((syncing) => {
      setIsSyncing(syncing);
      if (!syncing) {
        setLastSync(new Date());
      }
    });

    return () => unsubscribe();
  }, []);

  const syncNow = async () => {
    const result = await syncManager.syncToFirebase();
    if (result.success && result.synced > 0) {
      setLastSync(new Date());
    }
  };

  return (
    <OfflineContext.Provider value={{ isConnected, isSyncing, syncNow, lastSync }}>
      {children}
    </OfflineContext.Provider>
  );
};