import { apiClient, tokenManager } from './client';
import type { User, Trip, TripParticipant, Expense, DiaryEntry, Budget, Settlement, LoginResponse } from '../types/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
      console.error('❌ Register failed:', response.status, errorText);
      
      // Check for duplicate username/email errors
      const lowerError = errorText.toLowerCase();
      
      // Try to parse as JSON first
      try {
        const errorJson = JSON.parse(errorText);
        const detail = (errorJson.detail || '').toLowerCase();
        
        if (detail.includes('username') && (detail.includes('already') || detail.includes('exists') || detail.includes('taken') || detail.includes('duplicate'))) {
          throw new Error('USERNAME_EXISTS');
        }
        if (detail.includes('email') && (detail.includes('already') || detail.includes('exists') || detail.includes('taken') || detail.includes('duplicate'))) {
          throw new Error('EMAIL_EXISTS');
        }
      } catch (e) {
        if (e instanceof Error && (e.message === 'USERNAME_EXISTS' || e.message === 'EMAIL_EXISTS')) {
          throw e;
        }
      }
      
      // Check raw text for common error patterns
      if (lowerError.includes('username') && (lowerError.includes('already') || lowerError.includes('exists') || lowerError.includes('taken') || lowerError.includes('duplicate'))) {
        throw new Error('USERNAME_EXISTS');
      }
      if (lowerError.includes('email') && (lowerError.includes('already') || lowerError.includes('exists') || lowerError.includes('taken') || lowerError.includes('duplicate'))) {
        throw new Error('EMAIL_EXISTS');
      }
      
      // 409 Conflict usually means duplicate
      if (response.status === 409) {
        throw new Error('USERNAME_EXISTS');
      }
      
      // 400 Bad Request with specific messages
      if (response.status === 400) {
        if (lowerError.includes('username')) throw new Error('USERNAME_EXISTS');
        if (lowerError.includes('email')) throw new Error('EMAIL_EXISTS');
      }
      
      throw new Error('REGISTER_FAILED');
    }
    
    return response.json();
  },
  
  // Check if username is available by attempting a lightweight check
  // This tries multiple strategies to verify username availability
  checkUsername: async (username: string): Promise<{ available: boolean; message?: string }> => {
    console.log('🔍 Checking username availability:', username);
    
    // Strategy 1: Try dedicated check-username endpoint
    try {
      const response = await fetch(`${API_BASE}/auth/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      
      console.log('📡 Check username response:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        return { available: data.available !== false, message: data.message };
      }
      
      if (response.status === 409 || response.status === 400) {
        return { available: false, message: 'Username is already taken' };
      }
    } catch (e) {
      console.log('Check-username endpoint not available, trying alternative...');
    }
    
    // Strategy 2: Try GET endpoint
    try {
      const response = await fetch(`${API_BASE}/auth/check-username?username=${encodeURIComponent(username)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        return { available: data.available !== false };
      }
      
      if (response.status === 409 || response.status === 400) {
        return { available: false, message: 'Username is already taken' };
      }
    } catch (e) {
      console.log('GET check-username not available');
    }
    
    // Strategy 3: Try /users/exists endpoint
    try {
      const response = await fetch(`${API_BASE}/users/exists?username=${encodeURIComponent(username)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        return { available: !data.exists };
      }
    } catch (e) {
      console.log('Users exists endpoint not available');
    }
    
    // If no endpoint works, return unknown status
    // The actual check will happen during registration
    console.log('⚠️ No username check endpoint available - will verify on registration');
    return { available: true, message: 'Will be verified on registration' };
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
  // Add participant by username (backend searches registered users)
  addParticipant: async (tripId: number, username: string): Promise<{ message: string }> => {
    console.log('👥 Adding participant:', { tripId, username });
    try {
      const result = await apiClient.post<{ message: string }>(`/trips/${tripId}/participants`, { username });
      console.log('✅ Participant added:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to add participant:', error);
      throw error;
    }
  },
};

// Trip Invitations - Track pending trip invitations
const SEEN_TRIPS_KEY = 'seen_trip_ids';

export const invitationsApi = {
  // Get trips user hasn't seen yet (new invitations)
  getNewInvitations: async (): Promise<Trip[]> => {
    try {
      console.log('🔔 Fetching all trips to check for new invitations...');
      const allTrips = await tripsApi.getAll();
      console.log('🔔 Total trips:', allTrips.length, allTrips.map(t => ({ id: t.id, name: t.name, created_by: t.created_by })));
      
      const seenTripIds = JSON.parse(localStorage.getItem(SEEN_TRIPS_KEY) || '[]') as number[];
      console.log('🔔 Already seen trip IDs:', seenTripIds);
      
      // Filter trips that user hasn't seen
      const newTrips = allTrips.filter(trip => !seenTripIds.includes(trip.id));
      console.log('🔔 New (unseen) trips:', newTrips.length);
      return newTrips;
    } catch (error) {
      console.error('❌ Failed to get invitations:', error);
      return [];
    }
  },
  
  // Mark trip as seen (acknowledged)
  markAsSeen: (tripId: number) => {
    console.log('✅ Marking trip as seen:', tripId);
    const seenTripIds = JSON.parse(localStorage.getItem(SEEN_TRIPS_KEY) || '[]') as number[];
    if (!seenTripIds.includes(tripId)) {
      seenTripIds.push(tripId);
      localStorage.setItem(SEEN_TRIPS_KEY, JSON.stringify(seenTripIds));
    }
  },
  
  // Mark all trips as seen
  markAllAsSeen: (tripIds: number[]) => {
    console.log('✅ Marking all trips as seen:', tripIds);
    const seenTripIds = JSON.parse(localStorage.getItem(SEEN_TRIPS_KEY) || '[]') as number[];
    const updated = [...new Set([...seenTripIds, ...tripIds])];
    localStorage.setItem(SEEN_TRIPS_KEY, JSON.stringify(updated));
  },
  
  // Clear seen trips (for testing)
  clearSeen: () => {
    console.log('🗑️ Clearing seen trips');
    localStorage.removeItem(SEEN_TRIPS_KEY);
  },
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

// Types for diary photos
interface DiaryPhoto {
  id: number;
  file_path: string;
  file_name: string;
  memo: string | null;
  order_index: number;
  created_at: string;
}

interface DiaryEntryResponse {
  id: number;
  trip_id: number;
  user_id: number;
  username: string;
  date: string;
  expense_id: number | null;
  memo: string | null;
  photos: DiaryPhoto[];
  created_at: string;
  updated_at: string;
}

// Backend base URL for constructing photo URLs
// Use relative path to go through Vercel proxy (avoids CORS issues)
const getBackendUrl = () => {
  // In production (Vercel), use relative paths to proxy through vercel.json rewrites
  // In development, use the actual backend URL
  const isDev = import.meta.env.DEV;
  const backendStaticUrl = isDev 
    ? (import.meta.env.VITE_BACKEND_URL || 'https://thistimeapp.com')
    : ''; // Empty string = relative path, proxied by Vercel
  console.log('🔗 Backend URL for photos:', backendStaticUrl || '(using Vercel proxy)');
  return backendStaticUrl;
};

export const diaryApi = {
  // Legacy methods
  getByDate: async (tripId: number, date: string): Promise<DiaryEntry[]> => apiClient.get(`/trips/${tripId}/diary?date=${date}`),
  create: async (tripId: number, data: Omit<DiaryEntry, 'id' | 'trip_id' | 'created_at'>): Promise<DiaryEntry> => apiClient.post(`/trips/${tripId}/diary`, data),
  
  // === Date-Based Diary (for photo dumps and daily memos) ===
  
  // Get all diary entries for a specific date (shared among all participants)
  getEntriesForDate: async (tripId: number, date: string): Promise<DiaryEntryResponse[]> => {
    console.log('📖 Getting diary entries for date:', { tripId, date });
    try {
      const entries = await apiClient.get<DiaryEntryResponse[]>(`/diary/${tripId}/${date}`);
      console.log('✅ Diary entries loaded:', entries.length);
      
      // Debug: Log full entry details including photos
      entries.forEach((entry, idx) => {
        console.log(`📸 Entry ${idx}:`, {
          id: entry.id,
          user_id: entry.user_id,
          username: entry.username,
          expense_id: entry.expense_id,
          photoCount: entry.photos?.length || 0,
          photos: entry.photos?.map(p => ({ id: p.id, file_path: p.file_path, file_name: p.file_name }))
        });
      });
      
      return entries;
    } catch (error) {
      console.error('❌ Failed to get diary entries:', error);
      return [];
    }
  },
  
  // Upload photos for a specific date (max 10 per user per date)
  uploadPhotos: async (tripId: number, date: string, files: File[], memo?: string): Promise<DiaryPhoto[]> => {
    console.log('📷 Uploading photos:', { tripId, date, fileCount: files.length });
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (memo) formData.append('memo', memo);
    
    const token = tokenManager.getToken();
    const url = `${API_BASE}/diary/${tripId}/${date}/photos`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to upload photos:', errorText);
      throw new Error(`Upload failed: ${response.status}`);
    }
    
    const photos = await response.json();
    console.log('✅ Photos uploaded:', photos.length);
    return photos;
  },
  
  // Add or update daily memo
  setDailyMemo: async (tripId: number, date: string, memo: string): Promise<DiaryEntryResponse> => {
    console.log('📝 Setting daily memo:', { tripId, date, memo: memo.substring(0, 50) + '...' });
    
    const token = tokenManager.getToken();
    const url = `${API_BASE}/diary/${tripId}/${date}/memo`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ memo }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to set memo:', errorText);
      throw new Error(`Set memo failed: ${response.status}`);
    }
    
    return response.json();
  },
  
  // Delete a photo
  deletePhoto: async (tripId: number, date: string, photoId: number): Promise<void> => {
    console.log('🗑️ Deleting photo:', { tripId, date, photoId });
    
    const token = tokenManager.getToken();
    const url = `${API_BASE}/diary/${tripId}/${date}/photos/${photoId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to delete photo:', errorText);
      throw new Error(`Delete failed: ${response.status}`);
    }
    
    console.log('✅ Photo deleted');
  },
  
  // === Expense-Linked Diary ===
  
  // Get diary entry for a specific expense
  getExpenseDiary: async (expenseId: number): Promise<DiaryEntryResponse | null> => {
    console.log('📖 Getting diary for expense:', expenseId);
    try {
      const entry = await apiClient.get<DiaryEntryResponse>(`/diary/expenses/${expenseId}`);
      console.log('✅ Expense diary loaded:', entry);
      return entry;
    } catch (error) {
      console.log('⚠️ No diary entry for expense:', expenseId);
      return null;
    }
  },
  
  // Upload photo for expense (1 photo per expense)
  uploadExpensePhoto: async (expenseId: number, file: File, memo?: string): Promise<DiaryEntryResponse> => {
    console.log('📷 Uploading expense photo:', { expenseId, fileName: file.name });
    
    const formData = new FormData();
    formData.append('file', file);
    if (memo) formData.append('memo', memo);
    
    const token = tokenManager.getToken();
    const url = `${API_BASE}/diary/expenses/${expenseId}/photos`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to upload expense photo:', errorText);
      throw new Error(`Upload failed: ${response.status}`);
    }
    
    return response.json();
  },
  
  // Set memo for expense
  setExpenseMemo: async (expenseId: number, memo: string): Promise<DiaryEntryResponse> => {
    console.log('📝 Setting expense memo:', { expenseId });
    
    const token = tokenManager.getToken();
    const url = `${API_BASE}/diary/expenses/${expenseId}/memo`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ memo }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to set expense memo:', errorText);
      throw new Error(`Set memo failed: ${response.status}`);
    }
    
    return response.json();
  },
  
  // Delete expense photo
  deleteExpensePhoto: async (expenseId: number): Promise<void> => {
    console.log('🗑️ Deleting expense photo:', expenseId);
    
    const token = tokenManager.getToken();
    const url = `${API_BASE}/diary/expenses/${expenseId}/photos`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to delete expense photo:', errorText);
      throw new Error(`Delete failed: ${response.status}`);
    }
  },
  
  // === Photo Feed (all photos from trip, shared among participants) ===
  
  getPhotoFeed: async (tripId: number, offset = 0, limit = 20): Promise<DiaryPhoto[]> => {
    console.log('📷 Getting photo feed:', { tripId, offset, limit });
    try {
      const photos = await apiClient.get<DiaryPhoto[]>(`/trips/${tripId}/feed?offset=${offset}&limit=${limit}`);
      console.log('✅ Photo feed loaded:', photos.length);
      return photos;
    } catch (error) {
      console.error('❌ Failed to get photo feed:', error);
      return [];
    }
  },
  
  // Helper: construct full photo URL from file_path
  getPhotoUrl: (filePath: string, _photoId?: number): string => {
    const backendUrl = getBackendUrl();
    
    // Handle both absolute and relative paths
    if (filePath.startsWith('http')) {
      console.log('🖼️ Photo URL (already absolute):', filePath);
      return filePath;
    }
    
    // Use static file URL - goes through Vercel proxy in production
    // Remove leading slash if present
    let cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    
    // Construct URL - in production this is relative (proxied by Vercel)
    // In dev this goes directly to backend
    const fullUrl = backendUrl ? `${backendUrl}/${cleanPath}` : `/${cleanPath}`;
    
    console.log('🖼️ Photo URL constructed:', { 
      originalPath: filePath, 
      backendUrl: backendUrl || '(Vercel proxy)', 
      fullUrl
    });
    
    return fullUrl;
  },
  
  // Get photo as blob via API (with authentication)
  getPhotoBlob: async (photoId: number): Promise<string> => {
    try {
      const token = tokenManager.getToken();
      const response = await fetch(`${API_BASE}/photos/${photoId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch photo: ${response.status}`);
      }
      
      // Check if response is JSON (photo metadata) or blob (actual image)
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('image')) {
        // Direct image response
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        console.log('🖼️ Photo blob URL created:', url);
        return url;
      } else {
        // JSON response with photo metadata
        const data = await response.json();
        console.log('🖼️ Photo metadata:', data);
        // Return file_path based URL
        if (data.file_path) {
          return `${getBackendUrl()}/${data.file_path}`;
        }
        throw new Error('No file_path in response');
      }
    } catch (error) {
      console.error('❌ Failed to get photo blob:', error);
      throw error;
    }
  },
};

// === Photo Comments API (stored via diary memo system) ===
// Comments are stored in the diary entry's memo field as JSON with a special prefix

interface PhotoComment {
  id: string;
  photoId: number;
  text: string;
  author: string;
  userId: number;
  timestamp: string;
}

interface CommentsData {
  __type: 'photo_comments';
  comments: { [photoId: string]: PhotoComment[] };
}

const COMMENTS_PREFIX = '<!-- COMMENTS:';
const COMMENTS_SUFFIX = ' -->';
const COMMENTS_DATE = '9999-12-31'; // Special date for storing comments

// Helper to parse comments from memo
const parseCommentsFromMemo = (memo: string | null): CommentsData | null => {
  if (!memo) return null;
  
  const startIdx = memo.indexOf(COMMENTS_PREFIX);
  if (startIdx === -1) return null;
  
  const endIdx = memo.indexOf(COMMENTS_SUFFIX, startIdx);
  if (endIdx === -1) return null;
  
  try {
    const jsonStr = memo.substring(startIdx + COMMENTS_PREFIX.length, endIdx);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
};

// Helper to serialize comments to memo format
const serializeCommentsToMemo = (data: CommentsData): string => {
  return `${COMMENTS_PREFIX}${JSON.stringify(data)}${COMMENTS_SUFFIX}`;
};

export const commentsApi = {
  // Get all comments for a trip
  getComments: async (tripId: number): Promise<{ [photoId: string]: PhotoComment[] }> => {
    console.log('💬 Getting comments for trip:', tripId);
    try {
      const entries = await diaryApi.getEntriesForDate(tripId, COMMENTS_DATE);
      
      // Look for comments in all entries
      for (const entry of entries) {
        const data = parseCommentsFromMemo(entry.memo);
        if (data && data.__type === 'photo_comments') {
          console.log('✅ Comments loaded:', Object.keys(data.comments).length, 'photos');
          return data.comments;
        }
      }
      
      return {};
    } catch (error) {
      console.error('❌ Failed to get comments:', error);
      return {};
    }
  },
  
  // Add a comment to a photo
  addComment: async (
    tripId: number, 
    photoId: number, 
    text: string, 
    author: string, 
    userId: number
  ): Promise<PhotoComment> => {
    console.log('💬 Adding comment:', { tripId, photoId, author });
    
    // Get existing comments
    const existingComments = await commentsApi.getComments(tripId);
    
    // Create new comment
    const newComment: PhotoComment = {
      id: `${Date.now()}_${userId}`,
      photoId,
      text,
      author,
      userId,
      timestamp: new Date().toISOString(),
    };
    
    // Add to existing comments
    const photoKey = String(photoId);
    if (!existingComments[photoKey]) {
      existingComments[photoKey] = [];
    }
    existingComments[photoKey].push(newComment);
    
    // Save back to backend
    const commentsData: CommentsData = {
      __type: 'photo_comments',
      comments: existingComments,
    };
    
    await diaryApi.setDailyMemo(tripId, COMMENTS_DATE, serializeCommentsToMemo(commentsData));
    console.log('✅ Comment added');
    
    return newComment;
  },
  
  // Delete a comment
  deleteComment: async (tripId: number, photoId: number, commentId: string): Promise<void> => {
    console.log('🗑️ Deleting comment:', { tripId, photoId, commentId });
    
    const existingComments = await commentsApi.getComments(tripId);
    const photoKey = String(photoId);
    
    if (existingComments[photoKey]) {
      existingComments[photoKey] = existingComments[photoKey].filter(c => c.id !== commentId);
      
      const commentsData: CommentsData = {
        __type: 'photo_comments',
        comments: existingComments,
      };
      
      await diaryApi.setDailyMemo(tripId, COMMENTS_DATE, serializeCommentsToMemo(commentsData));
      console.log('✅ Comment deleted');
    }
  },
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

// Users API - Search registered users
export const usersApi = {
  // Get user by exact username
  getByUsername: async (username: string): Promise<User | null> => {
    console.log('🔍 Looking up user by username:', username);
    const url = `${API_BASE}/users/username/${encodeURIComponent(username)}`;
    console.log('🌐 API URL:', url);
    
    try {
      const token = tokenManager.getToken();
      console.log('🔑 Token exists:', !!token);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error response:', errorText);
        return null;
      }
      
      const user = await response.json();
      console.log('✅ Found user:', user);
      return user;
    } catch (error) {
      console.error('❌ Fetch error:', error);
      return null;
    }
  },
  
  // Get user by ID
  getById: async (userId: number): Promise<User | null> => {
    console.log('🔍 Looking up user by ID:', userId);
    try {
      const user = await apiClient.get<User>(`/users/${userId}`);
      console.log('✅ Found user:', user);
      return user;
    } catch (error) {
      console.log('⚠️ User not found by ID:', userId);
      return null;
    }
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

