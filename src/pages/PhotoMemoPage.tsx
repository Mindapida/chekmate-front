import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import { expensesApi } from '../api';
import type { Expense } from '../types/api';
import './PhotoMemoPage.css';

interface PhotoData {
  [expenseId: string]: string[]; // expense photos
}

interface PhotoDumpData {
  [dateKey: string]: string[]; // up to 5 photo dump images
}

interface MemoData {
  [dateKey: string]: string; // daily memo
}

const PHOTO_STORAGE_KEY = 'expense_photos';
const DUMP_STORAGE_KEY = 'photo_dump';
const MEMO_STORAGE_KEY = 'daily_memo';

export default function PhotoMemoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentTrip } = useTrips();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dumpFileInputRef = useRef<HTMLInputElement>(null);
  
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const [selectedDate] = useState(dateParam);
  
  // Data states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [photoData, setPhotoData] = useState<PhotoData>({});
  const [photoDump, setPhotoDump] = useState<PhotoDumpData>({});
  const [memoData, setMemoData] = useState<MemoData>({});
  const [dailyMemo, setDailyMemo] = useState('');
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [activeUploadType, setActiveUploadType] = useState<'expense' | 'dump' | null>(null);

  // Load data
  useEffect(() => {
    if (!currentTrip) return;
    
    // Load expenses
    const loadExpenses = async () => {
      setLoading(true);
      try {
        const data = await expensesApi.getByTrip(currentTrip.id, selectedDate);
        setExpenses(data);
      } catch (error) {
        const stored = localStorage.getItem(`expenses_${currentTrip.id}_${selectedDate}`);
        if (stored) setExpenses(JSON.parse(stored));
      }
      setLoading(false);
    };
    loadExpenses();
    
    // Load photos
    const storedPhotos = localStorage.getItem(`${PHOTO_STORAGE_KEY}_${currentTrip.id}`);
    if (storedPhotos) setPhotoData(JSON.parse(storedPhotos));
    
    // Load photo dumps
    const storedDumps = localStorage.getItem(`${DUMP_STORAGE_KEY}_${currentTrip.id}`);
    if (storedDumps) setPhotoDump(JSON.parse(storedDumps));
    
    // Load memos
    const storedMemos = localStorage.getItem(`${MEMO_STORAGE_KEY}_${currentTrip.id}`);
    if (storedMemos) {
      const memos = JSON.parse(storedMemos);
      setMemoData(memos);
      setDailyMemo(memos[selectedDate] || '');
    }
  }, [currentTrip, selectedDate]);

  const handleClose = () => navigate('/calendar');

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Photo handling
  const handlePhotoClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setActiveUploadType('expense');
    fileInputRef.current?.click();
  };

  const handleDumpClick = () => {
    const dumpCount = photoDump[selectedDate]?.length || 0;
    if (dumpCount >= 5) return;
    setActiveUploadType('dump');
    dumpFileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTrip) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      
      if (activeUploadType === 'expense' && selectedExpense) {
        const newData = { ...photoData };
        const expenseKey = `${selectedDate}_${selectedExpense.id}`;
        if (!newData[expenseKey]) newData[expenseKey] = [];
        newData[expenseKey].push(base64);
        setPhotoData(newData);
        localStorage.setItem(`${PHOTO_STORAGE_KEY}_${currentTrip.id}`, JSON.stringify(newData));
      } else if (activeUploadType === 'dump') {
        const newData = { ...photoDump };
        if (!newData[selectedDate]) newData[selectedDate] = [];
        if (newData[selectedDate].length < 5) {
          newData[selectedDate].push(base64);
          setPhotoDump(newData);
          localStorage.setItem(`${DUMP_STORAGE_KEY}_${currentTrip.id}`, JSON.stringify(newData));
        }
      }
    };
    reader.readAsDataURL(file);
    
    // Reset
    setSelectedExpense(null);
    setActiveUploadType(null);
    e.target.value = '';
  };

  const removeExpensePhoto = (expenseId: number, photoIndex: number) => {
    if (!currentTrip) return;
    const expenseKey = `${selectedDate}_${expenseId}`;
    const newData = { ...photoData };
    if (newData[expenseKey]) {
      newData[expenseKey].splice(photoIndex, 1);
      setPhotoData(newData);
      localStorage.setItem(`${PHOTO_STORAGE_KEY}_${currentTrip.id}`, JSON.stringify(newData));
    }
  };

  const removeDumpPhoto = (index: number) => {
    if (!currentTrip) return;
    const newData = { ...photoDump };
    if (newData[selectedDate]) {
      newData[selectedDate].splice(index, 1);
      setPhotoDump(newData);
      localStorage.setItem(`${DUMP_STORAGE_KEY}_${currentTrip.id}`, JSON.stringify(newData));
    }
  };

  // Memo handling
  const handleMemoChange = (value: string) => {
    setDailyMemo(value);
  };

  const handleSave = () => {
    if (!currentTrip) return;
    const newMemos = { ...memoData, [selectedDate]: dailyMemo };
    setMemoData(newMemos);
    localStorage.setItem(`${MEMO_STORAGE_KEY}_${currentTrip.id}`, JSON.stringify(newMemos));
    navigate('/calendar');
  };

  // Calculate totals
  const getTotalPhotos = () => {
    let count = 0;
    // Count expense photos for this date
    expenses.forEach(exp => {
      const key = `${selectedDate}_${exp.id}`;
      count += photoData[key]?.length || 0;
    });
    // Count photo dump
    count += photoDump[selectedDate]?.length || 0;
    return count;
  };

  const getCategoryEmoji = (category: string) => {
    const categories: { [key: string]: string } = {
      'food': '🍽️', 'drinks': '🍺', 'transport': '🚗', 'hotel': '🏨',
      'shopping': '🛍️', 'activity': '🎭', 'ticket': '🎫', 'gift': '🎁', 'cafe': '☕'
    };
    return categories[category.toLowerCase()] || '📝';
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

  const dumpPhotos = photoDump[selectedDate] || [];

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
                const expenseKey = `${selectedDate}_${expense.id}`;
                const photos = photoData[expenseKey] || [];
                
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
                      >
                        + 📷
                      </button>
                    </div>
                    {photos.length > 0 && (
                      <div className="expense-photos">
                        {photos.map((photo, idx) => (
                          <div key={idx} className="photo-thumb">
                            <img src={photo} alt={`Expense photo ${idx + 1}`} />
                            <button 
                              className="remove-photo"
                              onClick={() => removeExpensePhoto(expense.id, idx)}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}
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
            <span className="photo-count">{dumpPhotos.length} / 5</span>
          </div>
          <p className="section-hint">Add up to 5 extra photos from your day!</p>
          
          <div className="dump-grid">
            {dumpPhotos.map((photo, idx) => (
              <div key={idx} className="dump-photo">
                <img src={photo} alt={`Photo ${idx + 1}`} />
                <button 
                  className="remove-photo"
                  onClick={() => removeDumpPhoto(idx)}
                >×</button>
              </div>
            ))}
            {dumpPhotos.length < 5 && (
              <button className="add-dump-btn" onClick={handleDumpClick}>
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
          <p className="memo-hint">💡 This is a general memo for the whole day</p>
        </section>
      </div>

      {/* Save Button */}
      <div className="save-footer">
        <button className="save-btn" onClick={handleSave}>
          <span>✓</span>
          <span>SAVE & CLOSE</span>
        </button>
      </div>
    </div>
  );
}

