export interface User { id: number; username: string; created_at: string; }
export interface Trip { id: number; name: string; start_date: string; end_date: string; created_by: number; created_at: string; }
export interface TripParticipant { id: number; trip_id: number; name: string; user_id?: number; }
export interface Expense { id: number; trip_id: number; date: string; time: string; amount: number; currency: string; category: string; place: string; paid_by: number; created_at: string; }
export interface ExpenseShare { id: number; expense_id: number; participant_id: number; share_amount: number; }
export interface DiaryEntry { id: number; trip_id: number; date: string; entry_type: 'expense_photo' | 'expense_memo' | 'photo_dump' | 'daily_memo'; expense_id?: number; content?: string; photo_url?: string; display_order: number; created_at: string; }
export interface Budget { id: number; user_id: number; trip_id: number; amount: number; currency: string; }
export interface Settlement { id: number; trip_id: number; from_participant_id: number; to_participant_id: number; amount: number; currency: string; is_settled: boolean; }
export interface ExchangeRate { id: number; from_currency: string; to_currency: string; rate: number; date: string; }
export interface LoginResponse { access_token: string; token_type: string; }
export interface ApiError { detail: string; }














