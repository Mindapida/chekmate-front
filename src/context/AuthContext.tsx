import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../api';
import { tokenManager } from '../api/client';
import type { User } from '../types/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
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

  // Check if user is already logged in on mount (localStorage only)
  // Auto-login: Create default user if not exists (for testing)
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('mock_user');
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('mock_user');
        localStorage.removeItem('access_token');
      }
    } else {
      // Auto-create a test user for development
      const testUser: User = {
        id: 1,
        username: 'testuser',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('mock_user', JSON.stringify(testUser));
      localStorage.setItem('access_token', 'test_token_auto');
      addToRegisteredUsers(testUser);
      setUser(testUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    // 바로 로그인 처리 (백엔드 없이 작동)
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
  };

  const register = async (username: string, email: string, password: string) => {
    // 바로 회원가입 처리 (백엔드 없이 작동)
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

