import { apiClient, tokenManager } from './client';
import type { User, Trip, TripParticipant, Expense, DiaryEntry, Budget, Settlement, LoginResponse } from '../types/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Retry helper for 503 errors (server overload)
const fetchWithRetry = async (
  url: string, 
  options: RequestInit, 
  maxRetries = 3, 
  delayMs = 1000
): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If 503 (overload), retry after delay
      if (response.status === 503 && attempt < maxRetries - 1) {
        console.warn(`⏳ Server overloaded (503), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1))); // Exponential backoff
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        console.warn(`⏳ Network error, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Request failed after retries');
};

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    console.log('🔐 Login attempt:', { username, url: `${API_BASE}/auth/login` });
    
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    
    console.log('📡 Login response:', { status: response.status, ok: response.ok });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Login failed:', errorText);
      throw new Error('Login failed');
    }
    
    const data = await response.json();
    console.log('✅ Login success');
    tokenManager.setToken(data.access_token);
    return data;
  },
  register: async (username: string, email: string, password: string): Promise<User> => {
    console.log('📝 Register attempt:', { username, email, url: `${API_BASE}/auth/signup` });
    
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Register failed:', errorText);
      throw new Error('Register failed');
    }
    
    return response.json();
  },
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

// Expense creation payload (different from Expense type - no date, has participant_ids)
interface CreateExpensePayload {
  time: string;
  amount: number;
  currency: string;
  category: string;
  place: string | null;
  paid_by: number | null;
  participant_ids: number[];
}

export const expensesApi = {
  getByDate: async (tripId: number, date: string): Promise<Expense[]> => apiClient.get(`/expenses/${tripId}/${date}`),
  create: async (tripId: number, date: string, data: CreateExpensePayload): Promise<Expense> => {
    console.log('💰 Creating expense:', { tripId, date, data });
    
    const token = tokenManager.getToken();
    const url = `${API_BASE}/expenses/${tripId}/${date}`;
    
    // Use fetchWithRetry for 503 error handling
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    
    console.log('📡 Create expense response:', { status: response.status, ok: response.ok });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Create expense error:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    
    return response.json();
  },
  delete: async (tripId: number, expenseId: number): Promise<void> => apiClient.delete(`/expenses/${tripId}/${expenseId}`),
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
    console.log('📁 File object:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      lastModifiedDate: new Date(file.lastModified).toISOString(),
    });
    
    const formData = new FormData();
    formData.append('file', file);
    
    const token = tokenManager.getToken();
    const url = `${API_BASE}/expenses/${tripId}/${date}/ocr`;
    
    console.log('🌐 OCR API Request:', {
      url,
      tripId,
      date,
      hasToken: !!token,
      fileName: file.name,
    });
    
    // Use fetchWithRetry for 503 error handling
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    }, 3, 2000); // 3 retries, 2 second delay
    
    console.log('📡 OCR API Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OCR API Error:', response.status, errorText);
      throw new Error(`OCR failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('📦 OCR API Data:', data);
    return data;
  },
  
  // OCR and create expenses directly with participants
  createFromReceipt: async (tripId: number, date: string, file: File, participantIds?: number[]): Promise<Expense[]> => {
    console.log('📁 File object:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      lastModifiedDate: new Date(file.lastModified).toISOString(),
    });
    
    const formData = new FormData();
    formData.append('file', file);
    
    // participant_ids as comma-separated string (e.g., "1,2,3")
    if (participantIds && participantIds.length > 0) {
      formData.append('participant_ids', participantIds.join(','));
    }
    
    console.log('📦 FormData contents:');
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`  ${key}: [File] name=${value.name}, size=${value.size}, type=${value.type}`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
    
    const token = tokenManager.getToken();
    const url = `${API_BASE}/expenses/${tripId}/${date}/ocr/create`;
    
    console.log('🌐 OCR /create API Request:', {
      url,
      tripId,
      date,
      hasToken: !!token,
      fileName: file.name,
      participantIds: participantIds?.join(','),
    });
    
    // Use fetchWithRetry for 503 error handling
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    }, 3, 2000); // 3 retries, 2 second delay (longer for OCR)
    
    console.log('📡 OCR /create API Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });
    
    // Clone response to read both text and json
    const responseClone = response.clone();
    const rawText = await responseClone.text();
    console.log('📝 OCR /create Raw Response:', rawText);
    
    if (!response.ok) {
      console.error('❌ OCR /create API Error:', response.status, rawText);
      throw new Error(`OCR create failed: ${response.status} - ${rawText}`);
    }
    
    const data = await response.json();
    console.log('📦 OCR /create API Data:', data);
    console.log('📦 Data type:', typeof data);
    console.log('📦 Is Array:', Array.isArray(data));
    console.log('📦 Data keys:', data ? Object.keys(data) : 'null');
    
    // Handle different response structures
    if (Array.isArray(data)) {
      return data;
    } else if (data && typeof data === 'object') {
      // Check common wrapper keys
      if (data.expenses) return data.expenses;
      if (data.items) return data.items;
      if (data.data) return data.data;
      if (data.results) return data.results;
    }
    
    console.warn('⚠️ Unexpected response structure, returning as-is');
    return data;
  },
};

