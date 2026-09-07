import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getAccessToken } from '../api/authStorage';
import { refreshSession } from '../api/client';

const RealtimeContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef(new Map()); // event -> Set<handler>
  const refreshingRef = useRef(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !user) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; setConnected(false); }
      return;
    }

    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // If the access token expired between page load and socket handshake,
    // refresh it and reconnect with the fresh token.
    socket.on('connect_error', async () => {
      if (refreshingRef.current) return;
      if (socket.active) return;
      refreshingRef.current = true;
      const newToken = await refreshSession();
      refreshingRef.current = false;
      if (newToken) {
        socket.auth = { token: newToken };
        socket.connect();
      } else {
        setConnected(false);
      }
    });

    // Dispatch incoming events to registered handlers
    const handlers = {
      'new-order': 'new-order',
      'order-status-change': 'order-status-change',
      'low-stock-alert': 'low-stock-alert',
      'dashboard-update': 'dashboard-update'
    };
    Object.keys(handlers).forEach((event) => {
      socket.on(event, (payload) => {
        const subs = listenersRef.current.get(event);
        if (subs) subs.forEach((fn) => fn(payload));
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const on = (event, handler) => {
    if (!listenersRef.current.has(event)) listenersRef.current.set(event, new Set());
    listenersRef.current.get(event).add(handler);
    return () => listenersRef.current.get(event)?.delete(handler);
  };

  return (
    <RealtimeContext.Provider value={{ on, connected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);