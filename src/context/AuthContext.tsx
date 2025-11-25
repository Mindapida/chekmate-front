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

// Helper to add user to registered users list
const addToRegisteredUsers = (user: User) => {
  const stored = localStorage.getItem('registered_users');
  const users: { id: number; username: string }[] = stored ? JSON.parse(stored) : [];
  
  if (!users.some(u => u.username === user.username)) {
    users.push({ id: user.id, username: user.username });
    localStorage.setItem('registered_users', JSON.stringify(users));
  }
};

// Helper to find existing user by username
const findUserByUsername = (username: string): User | null => {
  const stored = localStorage.getItem('registered_users');
  if (!stored) return null;
  
  const users: { id: number; username: string }[] = JSON.parse(stored);
  const found = users.find(u => u.username === username);
  
  if (found) {
    return {
      id: found.id,
      username: found.username,
      created_at: new Date().toISOString(),
    };
  }
  return null;
};

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
      addToRegisteredUsers(userData);
      setUser(userData);
    } catch (error) {
      // Fallback: localStorage mock login for demo
      console.warn('Backend not available, using local storage');
      
      // Check if user exists
      const existingUser = findUserByUsername(username);
      const mockUser: User = existingUser || {
        id: Date.now(),
        username,
        created_at: new Date().toISOString(),
      };
      
      localStorage.setItem('mock_user', JSON.stringify(mockUser));
      localStorage.setItem('access_token', 'mock_token_' + Date.now());
      addToRegisteredUsers(mockUser);
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
      
      // Check if username already exists
      const existingUser = findUserByUsername(username);
      if (existingUser) {
        throw new Error('Username already exists');
      }
      
      const mockUser: User = {
        id: Date.now(),
        username,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('mock_user', JSON.stringify(mockUser));
      localStorage.setItem('access_token', 'mock_token_' + Date.now());
      addToRegisteredUsers(mockUser);
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

