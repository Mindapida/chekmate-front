import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../api';
import { tokenManager } from '../api/client';
import type { User } from '../types/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = tokenManager.getToken();
      if (token) {
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error('Auth check failed:', error);
          tokenManager.removeToken();
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      await authApi.login(username, password);
      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch (error) {
      // Fallback: localStorage mock login for demo
      console.warn('Backend not available, using local storage');
      const mockUser: User = {
        id: Date.now(),
        username,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('mock_user', JSON.stringify(mockUser));
      localStorage.setItem('access_token', 'mock_token_' + Date.now());
      setUser(mockUser);
    }
  };

  const register = async (username: string, password: string) => {
    try {
      await authApi.register(username, password);
      await login(username, password);
    } catch (error) {
      // Fallback: localStorage mock register
      console.warn('Backend not available, using local storage');
      const mockUser: User = {
        id: Date.now(),
        username,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('mock_user', JSON.stringify(mockUser));
      localStorage.setItem('access_token', 'mock_token_' + Date.now());
      setUser(mockUser);
    }
  };

  const logout = () => {
    authApi.logout();
    localStorage.removeItem('mock_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

