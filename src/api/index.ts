import { apiClient, tokenManager } from './client';
import type { User, Trip, TripParticipant, Expense, DiaryEntry, Budget, Settlement, LoginResponse } from '../types/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const formData = new URLSearchParams(); formData.append('username', username); formData.append('password', password);
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData });
    if (!response.ok) throw new Error('Login failed');
    const data = await response.json(); tokenManager.setToken(data.access_token); return data;
  },
  register: async (username: string, password: string): Promise<User> => apiClient.post('/auth/register', { username, password }),
  logout: () => tokenManager.removeToken(),
  getCurrentUser: async (): Promise<User> => apiClient.get('/users/me'),
};

export const tripsApi = {
  getAll: async (): Promise<Trip[]> => apiClient.get('/trips'),
  getById: async (id: number): Promise<Trip> => apiClient.get(`/trips/${id}`),
  create: async (data: { name: string; start_date: string; end_date: string }): Promise<Trip> => apiClient.post('/trips', data),
  delete: async (id: number): Promise<void> => apiClient.delete(`/trips/${id}`),
  getParticipants: async (tripId: number): Promise<TripParticipant[]> => apiClient.get(`/trips/${tripId}/participants`),
  addParticipant: async (tripId: number, name: string): Promise<TripParticipant> => apiClient.post(`/trips/${tripId}/participants`, { name }),
};

export const expensesApi = {
  getByTrip: async (tripId: number, date?: string): Promise<Expense[]> => apiClient.get(`/trips/${tripId}/expenses${date ? `?date=${date}` : ''}`),
  create: async (tripId: number, data: Omit<Expense, 'id' | 'trip_id' | 'created_at'>): Promise<Expense> => apiClient.post(`/trips/${tripId}/expenses`, data),
  delete: async (tripId: number, expenseId: number): Promise<void> => apiClient.delete(`/trips/${tripId}/expenses/${expenseId}`),
};

export const diaryApi = {
  getByDate: async (tripId: number, date: string): Promise<DiaryEntry[]> => apiClient.get(`/trips/${tripId}/diary?date=${date}`),
  create: async (tripId: number, data: Omit<DiaryEntry, 'id' | 'trip_id' | 'created_at'>): Promise<DiaryEntry> => apiClient.post(`/trips/${tripId}/diary`, data),
};

export const budgetApi = {
  get: async (tripId: number): Promise<Budget> => apiClient.get(`/trips/${tripId}/budget`),
  set: async (tripId: number, amount: number, currency: string): Promise<Budget> => apiClient.post(`/trips/${tripId}/budget`, { amount, currency }),
};

export const settlementApi = {
  calculate: async (tripId: number): Promise<Settlement[]> => apiClient.get(`/trips/${tripId}/settlement`),
};

export const fxApi = {
  getRate: async (from: string, to: string, date?: string): Promise<{ from_currency: string; to_currency: string; rate: number; date: string }> => {
    const params = new URLSearchParams({ from_currency: from, to_currency: to });
    if (date) params.append('date', date);
    return apiClient.get(`/fx/rate?${params.toString()}`);
  },
};

export const ocrApi = {
  // Preview OCR - returns parsed items without creating
  parseReceipt: async (tripId: number, date: string, file: File): Promise<{ amount: number; currency: string; description: string; date: string | null }[]> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = tokenManager.getToken();
    const response = await fetch(`${API_BASE}/expenses/${tripId}/${date}/ocr`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    if (!response.ok) throw new Error('OCR failed');
    return response.json();
  },
  
  // OCR and create expenses directly
  createFromReceipt: async (tripId: number, date: string, file: File): Promise<Expense[]> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = tokenManager.getToken();
    const response = await fetch(`${API_BASE}/expenses/${tripId}/${date}/ocr/create`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    if (!response.ok) throw new Error('OCR create failed');
    return response.json();
  },
};

