import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../lib/api';

interface AuthCtx {
  token: string | null;
  user: User | null;
  ready: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const storedToken = await SecureStore.getItemAsync('token');
      const storedUser  = await SecureStore.getItemAsync('user');
      if (storedToken && !isJwtExpired(storedToken) && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser) as User);
      } else {
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('user');
      }
      setReady(true);
    })();
  }, []);

  const login = async (t: string, u: User) => {
    await SecureStore.setItemAsync('token', t);
    await SecureStore.setItemAsync('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
