import { useEffect, useRef, useState } from 'react';
import {
  getLocalDashboardState,
  loadDashboardState,
  prepareDashboardStateForPersistence,
  saveDashboardState,
} from '../services/dashboardStore';

export function useDashboardState({ initialObras, onSyncError }) {
  const [obras, setObras] = useState(() => getLocalDashboardState(initialObras));
  const [syncStatus, setSyncStatus] = useState('idle');
  const hasLoadedRemoteState = useRef(false);
  const latestObrasRef = useRef(obras);
  const syncTimeoutRef = useRef(null);
  const onSyncErrorRef = useRef(onSyncError);
  const persistedSnapshot = JSON.stringify(prepareDashboardStateForPersistence(obras));

  useEffect(() => {
    onSyncErrorRef.current = onSyncError;
  }, [onSyncError]);

  useEffect(() => {
    latestObrasRef.current = obras;
  }, [obras]);

  useEffect(() => {
    let active = true;

    async function hydrateState() {
      try {
        const loadedState = await loadDashboardState(initialObras);

        if (active) {
          setObras(Array.isArray(loadedState) ? loadedState : initialObras);
          hasLoadedRemoteState.current = true;
        }
      } catch (error) {
        if (active) {
          setObras(initialObras);
          hasLoadedRemoteState.current = true;
          setSyncStatus('error');
          if (typeof onSyncErrorRef.current === 'function') {
            onSyncErrorRef.current(error);
          }
        }
      }
    }

    hydrateState();

    return () => {
      active = false;
    };
  }, [initialObras]);

  useEffect(() => {
    if (!hasLoadedRemoteState.current) {
      return undefined;
    }

    let cancelled = false;

    async function persistState() {
      setSyncStatus('saving');

      try {
        await saveDashboardState(latestObrasRef.current);

        if (cancelled) {
          return;
        }

        setSyncStatus('saved');
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = setTimeout(() => {
          setSyncStatus('idle');
        }, 2200);
      } catch (error) {
        if (!cancelled) {
          setSyncStatus('error');
          if (typeof onSyncErrorRef.current === 'function') {
            onSyncErrorRef.current();
          }
        }
      }
    }

    const timeoutId = setTimeout(() => {
      persistState();
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [persistedSnapshot]);

  useEffect(() => () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
  }, []);

  return {
    obras,
    setObras,
    syncStatus,
  };
}
