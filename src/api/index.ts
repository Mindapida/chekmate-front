// API Service Layer for Checkmate
import api from './client';
import type {
  User,
  LoginRequest,
  LoginResponse,
  SignupRequest,
  Trip,
  TripDetail,
  TripParticipant,
  TripStatus,
  CreateTripRequest,
  Expense,
  CreateExpenseRequest,
  OCRExpensePreview,
  DiaryEntry,
  DiaryPhoto,
  DailyIndicator,
  DailyData,
  Mood,
  Budget,
  BudgetSummary,
  Settlement,
  SettlementResult,
  ExchangeRate,
} from '../types/api';

// ============ Auth ============
export const authApi = {
  signup: (data: SignupRequest) => 
    api.post<User>('/auth/signup', data),
  
  login: async (data: LoginRequest) => {
    const response = await api.post<LoginResponse>('/auth/login', data);
    api.setToken(response.access_token);
    return response;
  },
  
  logout: () => {
    api.removeToken();
    return Promise.resolve();
  },
};

// ============ Users ============
export const usersApi = {
  getMe: () => api.get<User>('/users/me'),
  getById: (userId: number) => api.get<User>(`/users/${userId}`),
};

// ============ Trips ============
export const tripsApi = {
  list: () => api.get<Trip[]>('/trips'),
  
  get: (tripId: number) => api.get<TripDetail>(`/trips/${tripId}`),
  
  create: (data: CreateTripRequest) => api.post<Trip>('/trips', data),
  
  update: (tripId: number, data: Partial<CreateTripRequest>) => 
    api.put<Trip>(`/trips/${tripId}`, data),
  
  delete: (tripId: number) => api.del<{ message: string }>(`/trips/${tripId}`),
  
  getStatus: (tripId: number) => api.get<TripStatus>(`/trips/${tripId}/status`),
  
  setCurrent: (tripId: number) => 
    api.post<{ message: string }>(`/trips/${tripId}/set_current`),
  
  inviteParticipant: (tripId: number, username: string) => 
    api.post<{ message: string }>(`/trips/${tripId}/participants`, { username }),
  
  getParticipants: (tripId: number) => 
    api.get<TripParticipant[]>(`/trips/${tripId}/participants`),
  
  settle: (tripId: number) => 
    api.post<{ message: string }>(`/trips/${tripId}/settle`),
  
  getSettlement: (tripId: number) => 
    api.get<SettlementResult>(`/trips/${tripId}/settlement`),
  
  getFeed: (tripId: number, offset = 0, limit = 10) => 
    api.get<DiaryPhoto[]>(`/trips/${tripId}/feed?offset=${offset}&limit=${limit}`),
};

// ============ Expenses ============
export const expensesApi = {
  getByDate: (tripId: number, date: string) => 
    api.get<Expense[]>(`/expenses/${tripId}/${date}`),
  
  create: (tripId: number, date: string, data: CreateExpenseRequest) => 
    api.post<Expense>(`/expenses/${tripId}/${date}`, data),
  
  update: (expenseId: number, data: Partial<CreateExpenseRequest>) => 
    api.put<Expense>(`/expenses/${expenseId}`, data),
  
  delete: (expenseId: number) => 
    api.del<{ message: string }>(`/expenses/${expenseId}`),
  
  reorder: (tripId: number, date: string, expenseIds: number[]) => 
    api.put<Expense[]>(`/expenses/${tripId}/${date}/reorder`, expenseIds),
  
  ocrPreview: (tripId: number, date: string, file: File) => 
    api.uploadFile<OCRExpensePreview[]>(`/expenses/${tripId}/${date}/ocr`, file),
  
  ocrCreate: (tripId: number, date: string, file: File, participantIds?: number[]) => 
    api.uploadFile<Expense[]>(
      `/expenses/${tripId}/${date}/ocr/create`, 
      file,
      participantIds ? { participant_ids: participantIds.join(',') } : undefined
    ),
};

// ============ Diary ============
export const diaryApi = {
  // Date-based
  getByDate: (tripId: number, date: string) => 
    api.get<DiaryEntry[]>(`/diary/${tripId}/${date}`),
  
  uploadPhotos: (tripId: number, date: string, files: File[], memo?: string) => 
    api.uploadFile<DiaryPhoto[]>(
      `/diary/${tripId}/${date}/photos`,
      files,
      memo ? { memo } : undefined
    ),
  
  updateMemo: (tripId: number, date: string, memo: string) => 
    api.post<DiaryEntry>(`/diary/${tripId}/${date}/memo`, { memo }),
  
  deleteMemo: (tripId: number, date: string) => 
    api.del<{ message: string }>(`/diary/${tripId}/${date}/memo`),
  
  deletePhoto: (tripId: number, date: string, photoId: number) => 
    api.del<{ message: string }>(`/diary/${tripId}/${date}/photos/${photoId}`),
  
  // Expense-linked
  getByExpense: (expenseId: number) => 
    api.get<DiaryEntry>(`/diary/expenses/${expenseId}`),
  
  uploadExpensePhoto: (expenseId: number, file: File, memo?: string) => 
    api.uploadFile<DiaryEntry>(
      `/diary/expenses/${expenseId}/photos`,
      file,
      memo ? { memo } : undefined
    ),
  
  updateExpenseMemo: (expenseId: number, memo: string) => 
    api.post<DiaryEntry>(`/diary/expenses/${expenseId}/memo`, { memo }),
  
  deleteExpensePhoto: (expenseId: number) => 
    api.del<{ message: string }>(`/diary/expenses/${expenseId}/photos`),
  
  deleteExpenseMemo: (expenseId: number) => 
    api.del<{ message: string }>(`/diary/expenses/${expenseId}/memo`),
};

// ============ Calendar ============
export const calendarApi = {
  getDays: (tripId: number) => 
    api.get<DailyIndicator[]>(`/calendar/${tripId}/days`),
  
  getDailyData: (tripId: number, date: string) => 
    api.get<DailyData>(`/calendar/${tripId}/${date}`),
  
  setMood: (tripId: number, date: string, moodEmoji: string) => 
    api.post<Mood>(`/calendar/${tripId}/${date}/mood`, { mood_emoji: moodEmoji }),
};

// ============ Budget ============
export const budgetApi = {
  get: (tripId: number) => api.get<Budget>(`/budget/${tripId}`),
  
  set: (tripId: number, budgetAmountBase: number) => 
    api.post<Budget>(`/budget/${tripId}`, { budget_amount_base: budgetAmountBase }),
  
  getSummary: (tripId: number) => 
    api.get<BudgetSummary>(`/budget/${tripId}/summary`),
};

// ============ Settlement ============
export const settlementApi = {
  trigger: (tripId: number) => 
    api.post<{ message: string; settlement_id: number }>(`/settlement/${tripId}/trigger`),
  
  getResult: (tripId: number) => 
    api.get<Settlement>(`/settlement/${tripId}/result`),
};

// ============ FX Rates ============
export const fxRatesApi = {
  getByDate: (date: string, tripId: number, currency = 'USD') => 
    api.get<ExchangeRate>(`/fx-rates/${date}?currency=${currency}&trip_id=${tripId}`),
  
  getLatest: (tripId: number, currency = 'USD') => 
    api.get<ExchangeRate>(`/fx-rates/latest?currency=${currency}&trip_id=${tripId}`),
};

// ============ OCR ============
export const ocrApi = {
  parse: (file: File) => api.uploadFile<OCRExpensePreview[]>('/ocr/parse', file),
};

// ============ Photos ============
export const photosApi = {
  getDetail: (photoId: number) => api.get<DiaryPhoto>(`/photos/${photoId}`),
};

// Export all APIs
export default {
  auth: authApi,
  users: usersApi,
  trips: tripsApi,
  expenses: expensesApi,
  diary: diaryApi,
  calendar: calendarApi,
  budget: budgetApi,
  settlement: settlementApi,
  fxRates: fxRatesApi,
  ocr: ocrApi,
  photos: photosApi,
};

