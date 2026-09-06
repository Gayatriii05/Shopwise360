import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef(new Map()); // event -> Set<handler>

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; setConnected(false); }
      return;
    }

    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

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