// API Types for Checkmate Frontend

// ============ User ============
export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}

// ============ Trip ============
export interface Trip {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'ongoing' | 'finished';
  is_settled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TripDetail extends Trip {
  participants: TripParticipant[];
}

export interface TripParticipant {
  id: number;
  username: string;
  is_creator: boolean;
  has_settled: boolean;
}

export interface CreateTripRequest {
  name: string;
  start_date: string;
  end_date: string;
}

export interface TripStatus {
  trip_id: number;
  status: 'upcoming' | 'ongoing' | 'finished';
  current_date: string;
  start_date: string;
  end_date: string;
}

// ============ Expense ============
export interface Expense {
  id: number;
  trip_id: number;
  payer_id: number;
  payer_username: string;
  date: string;
  amount: number;
  currency: string;
  amount_krw: number;
  description: string | null;
  category: ExpenseCategory | null;
  display_order: number;
  participants: ExpenseParticipant[];
  created_at: string;
  updated_at: string;
}

export interface ExpenseParticipant {
  user_id: number;
  username: string;
  share_amount_krw: number;
}

export type ExpenseCategory =
  | 'food'
  | 'transportation'
  | 'accommodation'
  | 'shopping'
  | 'entertainment'
  | 'ticket'
  | 'souvenir'
  | 'drink'
  | 'health'
  | 'communication'
  | 'other';

export interface CreateExpenseRequest {
  amount: number;
  currency: string;
  description?: string;
  category?: ExpenseCategory;
  participant_ids: number[];
}

export interface OCRExpensePreview {
  amount: number;
  currency: string;
  description: string | null;
  date: null;
}

// ============ Diary ============
export interface DiaryEntry {
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

export interface DiaryPhoto {
  id: number;
  file_path: string;
  file_name: string;
  memo: null;
  order_index: number;
  created_at: string;
}

// ============ Calendar ============
export interface DailyIndicator {
  date: string;
  has_expense: boolean;
  has_diary: boolean;
  has_mood: boolean;
}

export interface DailyData {
  date: string;
  expenses: Expense[];
  diary_entries: DiaryEntry[];
  moods: Mood[];
}

export interface Mood {
  id: number;
  trip_id: number;
  user_id: number;
  username: string;
  date: string;
  mood_emoji: string;
  created_at: string;
  updated_at: string;
}

// ============ Budget ============
export interface Budget {
  trip_id: number;
  budget_amount_base: number;
  base_currency: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetSummary {
  trip_id: number;
  budget_amount_base: number;
  total_spent_base: number;
  remaining_base: number;
  fill_ratio: number;
  base_currency: string;
  categories: BudgetCategoryItem[];
  uncategorized_spent_base: number;
  uncategorized_count: number;
}

export interface BudgetCategoryItem {
  category: string;
  spent_amount_base: number;
  expense_count: number;
  percentage_of_total: number;
  percentage_of_budget: number;
}

// ============ Settlement ============
export interface Settlement {
  trip_id: number;
  settlements: SettlementItem[];
  created_at: string;
}

export interface SettlementItem {
  from_user_id: number;
  from_username: string;
  to_user_id: number;
  to_username: string;
  amount_krw: number;
}

export interface SettlementResult {
  id: number;
  trip_id: number;
  calculation_data: {
    net_balances: Record<string, number>;
    transfers: Array<{
      from_user_id: number;
      from_username: string;
      to_user_id: number;
      to_username: string;
      amount_base: number;
    }>;
    total_expenses_base: number;
    participant_count: number;
  };
  summary: string;
  created_at: string;
}

// ============ FX Rate ============
export interface ExchangeRate {
  id: number;
  trip_id: number;
  date: string;
  currency: string;
  rate_to_krw: number;
  created_at: string;
}

// ============ API Error ============
export interface ApiError {
  detail: string | Array<{
    loc: string[];
    msg: string;
    type: string;
  }>;
}

// ============ Currency ============
export type Currency = 'KRW' | 'USD' | 'EUR' | 'JPY' | 'CNY' | 'AUD' | 'GBP';

export const SUPPORTED_CURRENCIES: Currency[] = ['KRW', 'USD', 'EUR', 'JPY', 'CNY', 'AUD', 'GBP'];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'food',
  'transportation',
  'accommodation',
  'shopping',
  'entertainment',
  'ticket',
  'souvenir',
  'drink',
  'health',
  'communication',
  'other',
];

