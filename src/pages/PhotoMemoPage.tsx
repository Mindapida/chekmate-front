import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { expensesApi, diaryApi } from '../api';
import type { Expense } from '../types/api';
import './PhotoMemoPage.css';

// Types for diary photos from API
interface DiaryPhoto {
  id: number;
  file_path: string;
  file_name: string;
  memo: string | null;
  order_index: number;
  created_at: string;
}

interface DiaryEntry {
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

export default function PhotoMemoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentTrip } = useTrips();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dumpFileInputRef = useRef<HTMLInputElement>(null);
  
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const [selectedDate] = useState(dateParam);
  
  // Data states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [dailyMemo, setDailyMemo] = useState('');
  const [expenseMemos, setExpenseMemos] = useState<{ [expenseId: number]: string }>({});
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [activeUploadType, setActiveUploadType] = useState<'expense' | 'dump' | null>(null);

  // Load data from backend
  const loadData = useCallback(async () => {
    if (!currentTrip) return;
      setLoading(true);
    
      try {
      // Load expenses from API
      const expData = await expensesApi.getByDate(currentTrip.id, selectedDate);
      setExpenses(expData);
      
      // Load diary entries from API (shared among all participants!)
      const entries = await diaryApi.getEntriesForDate(currentTrip.id, selectedDate);
      setDiaryEntries(entries);
      
      // Extract daily memo (from date-based entries)
      const dateEntry = entries.find(e => e.expense_id === null);
      if (dateEntry?.memo) {
        setDailyMemo(dateEntry.memo);
      }
      
      // Extract expense memos
      const memos: { [expenseId: number]: string } = {};
      entries.forEach(entry => {
        if (entry.expense_id && entry.memo) {
          memos[entry.expense_id] = entry.memo;
        }
      });
      setExpenseMemos(memos);
      
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentTrip, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClose = () => navigate('/calendar');

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Photo handling - upload to backend
  const handlePhotoClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setActiveUploadType('expense');
    fileInputRef.current?.click();
  };

  const handleDumpClick = () => {
    const dumpPhotos = getDumpPhotos();
    if (dumpPhotos.length >= 10) return; // Max 10 per user per date
    setActiveUploadType('dump');
    dumpFileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTrip) return;

    setSaving(true);
    try {
      if (activeUploadType === 'expense' && selectedExpense) {
        // Upload expense photo to backend
        await diaryApi.uploadExpensePhoto(selectedExpense.id, file);
        console.log('✅ Expense photo uploaded');
      } else if (activeUploadType === 'dump') {
        // Upload photo dump to backend
        await diaryApi.uploadPhotos(currentTrip.id, selectedDate, [file]);
        console.log('✅ Photo dump uploaded');
      }
      
      // Reload data to get updated photos
      await loadData();
    } catch (error) {
      console.error('Failed to upload photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setSaving(false);
    setSelectedExpense(null);
    setActiveUploadType(null);
    e.target.value = '';
    }
  };

  const removeExpensePhoto = async (expenseId: number) => {
    if (!currentTrip) return;
    
    setSaving(true);
    try {
      await diaryApi.deleteExpensePhoto(expenseId);
      console.log('✅ Expense photo deleted');
      await loadData();
    } catch (error) {
      console.error('Failed to delete expense photo:', error);
    } finally {
      setSaving(false);
    }
  };

  const removeDumpPhoto = async (photoId: number) => {
    if (!currentTrip) return;
    
    setSaving(true);
    try {
      await diaryApi.deletePhoto(currentTrip.id, selectedDate, photoId);
      console.log('✅ Photo deleted');
      await loadData();
    } catch (error) {
      console.error('Failed to delete photo:', error);
    } finally {
      setSaving(false);
    }
  };

  // Memo handling
  const handleMemoChange = (value: string) => {
    setDailyMemo(value);
  };

  const handleExpenseMemoChange = (expenseId: number, value: string) => {
    setExpenseMemos(prev => ({ ...prev, [expenseId]: value }));
  };

  const handleSave = async () => {
    if (!currentTrip) return;
    
    setSaving(true);
    try {
      // Save daily memo to backend
      if (dailyMemo.trim()) {
        await diaryApi.setDailyMemo(currentTrip.id, selectedDate, dailyMemo);
        console.log('✅ Daily memo saved');
      }
      
      // Save expense memos to backend
      for (const [expenseId, memo] of Object.entries(expenseMemos)) {
        if (memo.trim()) {
          await diaryApi.setExpenseMemo(Number(expenseId), memo);
          console.log('✅ Expense memo saved for:', expenseId);
        }
      }
      
    navigate('/calendar');
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Helper: get photos for an expense from diary entries
  const getExpensePhotos = (expenseId: number): DiaryPhoto[] => {
    const entry = diaryEntries.find(e => e.expense_id === expenseId);
    return entry?.photos || [];
  };

  // Helper: get photo dump (date-based photos) from diary entries
  const getDumpPhotos = (): DiaryPhoto[] => {
    const dateEntry = diaryEntries.find(e => e.expense_id === null);
    return dateEntry?.photos || [];
  };

  // Calculate totals
  const getTotalPhotos = () => {
    let count = 0;
    diaryEntries.forEach(entry => {
      count += entry.photos?.length || 0;
    });
    return count;
  };

  const getCategoryEmoji = (category: string) => {
    const categories: { [key: string]: string } = {
      'food': '🍽️', 'drinks': '🍺', 'transport': '🚗', 'hotel': '🏨',
      'shopping': '🛍️', 'activity': '🎭', 'ticket': '🎫', 'gift': '🎁', 'cafe': '☕',
      'transportation': '🚗', 'accommodation': '🏨', 'entertainment': '🎭',
      'souvenir': '🎁', 'drink': '🍺', 'health': '💊', 'communication': '📱', 'other': '📝'
    };
    return categories[category?.toLowerCase()] || '📝';
  };

  if (!currentTrip) {
    return (
      <div className="photomemo-page">
        <div className="no-trip">
          <p>No trip selected</p>
          <button onClick={() => navigate('/home')}>Go to Home</button>
        </div>
      </div>
    );
  }

  const dumpPhotos = getDumpPhotos();

  return (
    <div className="photomemo-page">
      {/* Hidden file inputs */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input 
        type="file" 
        ref={dumpFileInputRef}
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Header */}
      <header className="photomemo-header">
        <div className="header-left">
          <span className="header-icon">📷</span>
          <div className="header-title">
            <h1>PHOTO & MEMO</h1>
            <p className="header-date">{formatDate(selectedDate)}</p>
          </div>
        </div>
        <button className="close-btn" onClick={handleClose}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-icon">📸</span>
          <span>Total Photos: <strong>{getTotalPhotos()}</strong></span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">💰</span>
          <span>Expenses: <strong>{expenses.length}</strong></span>
        </div>
        <div className="stat-item shared-badge">
          <span className="stat-icon">👥</span>
          <span>Shared with all</span>
        </div>
      </div>

      <div className="page-content">
        {/* Expenses Section */}
        <section className="section expenses-section">
          <h2 className="section-title">📝 Expenses</h2>
          {loading ? (
            <div className="loading">Loading...</div>
          ) : expenses.length === 0 ? (
            <div className="empty-box">
              <span className="empty-icon">📝</span>
              <p>No expenses for this day</p>
              <p className="hint">Add expenses first to attach photos and memos</p>
            </div>
          ) : (
            <div className="expense-list">
              {expenses.map(expense => {
                const photos = getExpensePhotos(expense.id);
                const expenseMemo = expenseMemos[expense.id] || '';
                
                return (
                  <div key={expense.id} className="expense-item">
                    <div className="expense-info">
                      <span className="expense-emoji">{getCategoryEmoji(expense.category)}</span>
                      <div className="expense-details">
                        <div className="expense-top-row">
                          <span className="expense-time">{expense.time || '--:--'}</span>
                          <span className="expense-category-label">{expense.category}</span>
                        </div>
                        <span className="expense-place">{expense.place || 'No place'}</span>
                        <span className="expense-amount">{expense.amount.toLocaleString()} {expense.currency}</span>
                      </div>
                      <button 
                        className="add-photo-btn"
                        onClick={() => handlePhotoClick(expense)}
                        disabled={saving || photos.length >= 1}
                      >
                        {photos.length >= 1 ? '📷' : '+ 📷'}
                      </button>
                    </div>
                    {/* Expense Photos */}
                    {photos.length > 0 && (
                      <div className="expense-photos">
                        {photos.map((photo) => (
                          <div key={photo.id} className="photo-thumb">
                            <img src={diaryApi.getPhotoUrl(photo.file_path)} alt={photo.file_name} />
                            <button 
                              className="remove-photo"
                              onClick={() => removeExpensePhoto(expense.id)}
                              disabled={saving}
                            >×</button>
                            <span className="photo-author">{user?.username === diaryEntries.find(e => e.expense_id === expense.id)?.username ? 'You' : diaryEntries.find(e => e.expense_id === expense.id)?.username}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Expense Memo */}
                    <div className="expense-memo">
                      <textarea
                        className="expense-memo-input"
                        placeholder="Add a note for this expense..."
                        value={expenseMemo}
                        onChange={(e) => handleExpenseMemoChange(expense.id, e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Photo Dump Section */}
        <section className="section dump-section">
          <div className="section-header">
            <h2 className="section-title">📷 PHOTO DUMP</h2>
            <span className="photo-count">{dumpPhotos.length} / 10</span>
          </div>
          <p className="section-hint">Add up to 10 photos from your day! (Shared with all participants)</p>
          
          <div className="dump-grid">
            {dumpPhotos.map((photo) => (
              <div key={photo.id} className="dump-photo">
                <img src={diaryApi.getPhotoUrl(photo.file_path)} alt={photo.file_name} />
                <button 
                  className="remove-photo"
                  onClick={() => removeDumpPhoto(photo.id)}
                  disabled={saving}
                >×</button>
              </div>
            ))}
            {dumpPhotos.length < 10 && (
              <button className="add-dump-btn" onClick={handleDumpClick} disabled={saving}>
                <span className="add-icon">+</span>
                <span className="add-text">ADD</span>
              </button>
            )}
          </div>
        </section>

        {/* Daily Memo Section */}
        <section className="section memo-section">
          <h2 className="section-title">✍️ DAILY MEMO</h2>
          <textarea
            className="memo-textarea"
            placeholder="Write your thoughts about today..."
            value={dailyMemo}
            onChange={(e) => handleMemoChange(e.target.value)}
            rows={4}
          />
          <p className="memo-hint">💡 This memo is shared with all trip participants</p>
        </section>
      </div>

      {/* Save Button */}
      <div className="save-footer">
        <button className="save-btn" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <span className="spinner"></span>
              <span>SAVING...</span>
            </>
          ) : (
            <>
          <span>✓</span>
          <span>SAVE & CLOSE</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
