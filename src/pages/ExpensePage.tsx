import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import { expensesApi, tripsApi, ocrApi } from '../api';
import type { Expense, TripParticipant } from '../types/api';
import './ExpensePage.css';

// Category emoji mapping - 9 categories from Figma
const CATEGORIES = [
  { emoji: '🍽️', name: 'Food' },
  { emoji: '🍺', name: 'Drinks' },
  { emoji: '🚗', name: 'Transport' },
  { emoji: '🏨', name: 'Hotel' },
  { emoji: '🛍️', name: 'Shopping' },
  { emoji: '🎭', name: 'Activity' },
  { emoji: '🎫', name: 'Ticket' },
  { emoji: '🎁', name: 'Gift' },
  { emoji: '☕', name: 'Cafe' },
];

// Currencies
const CURRENCIES = ['KRW', 'USD', 'JPY', 'EUR', 'GBP', 'CNY', 'AUD'];

// OCR Preview Item type
interface OcrItem {
  amount: number;
  currency: string;
  description: string;
  date: string | null;
  selected: boolean;
}

export default function ExpensePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentTrip } = useTrips();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const [selectedDate] = useState(dateParam);
  
  // Exchange rate state
  const [fxRate, setFxRate] = useState<{ rate: number; from: string; to: string } | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  
  // Expenses list
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [participants, setParticipants] = useState<TripParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Add expense modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
    hour: '12',
    minute: '00',
    amount: '',
    currency: 'JPY',
    place: '',
    category: '',
    paid_by: 0,
    split_with: [] as number[],
  });

  // OCR states
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Load exchange rate - using free API or fallback
  useEffect(() => {
    const loadFxRate = async () => {
      setFxLoading(true);
      try {
        // Try free exchangerate API first
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (response.ok) {
          const data = await response.json();
          setFxRate({ rate: Math.round(data.rates.KRW), from: 'USD', to: 'KRW' });
        } else {
          throw new Error('Exchange rate API failed');
        }
      } catch {
        // Fallback to approximate rate
        setFxRate({ rate: 1380, from: 'USD', to: 'KRW' });
      }
      setFxLoading(false);
    };
    loadFxRate();
  }, [selectedDate]);

  // Load expenses and participants
  useEffect(() => {
    const loadData = async () => {
      if (!currentTrip) return;
      setLoading(true);
      try {
        const [expData, partData] = await Promise.all([
          expensesApi.getByDate(currentTrip.id, selectedDate),
          tripsApi.getParticipants(currentTrip.id),
        ]);
        setExpenses(expData);
        setParticipants(partData);
      } catch (error) {
        console.warn('Failed to load data:', error);
        const stored = localStorage.getItem(`expenses_${currentTrip.id}_${selectedDate}`);
        if (stored) setExpenses(JSON.parse(stored));
      }
      setLoading(false);
    };
    loadData();
  }, [currentTrip, selectedDate]);

  const handleBack = () => navigate('/calendar');

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
  };

  const handleAddExpense = async () => {
    if (!currentTrip || !newExpense.amount || !newExpense.category) return;
    
    const time = `${newExpense.hour.padStart(2, '0')}:${newExpense.minute.padStart(2, '0')}`;
    
    // Backend expects: no date (it's in URL), and participant_ids is required
    const expenseData = {
      time: time,
      amount: parseFloat(newExpense.amount),
      currency: newExpense.currency,
      category: newExpense.category,
      place: newExpense.place || null,
      paid_by: newExpense.paid_by || null,
      // Use selected participants or all participants if none selected
      participant_ids: newExpense.split_with.length > 0 
        ? newExpense.split_with 
        : participants.map(p => p.id),
    };

    try {
      const created = await expensesApi.create(currentTrip.id, selectedDate, expenseData);
      setExpenses([...expenses, created]);
    } catch (error) {
      console.warn('Failed to create expense:', error);
      
      // Check if it's a server overload error
      const errorMsg = error instanceof Error ? error.message : '';
      if (errorMsg.includes('503') || errorMsg.includes('overload')) {
        alert('⚠️ 서버가 일시적으로 바쁩니다. 잠시 후 다시 시도해주세요.\n(Server is temporarily busy. Please try again.)');
        return;
      }
      
      // Fallback to local storage for other errors
      const localExpense: Expense = { 
        id: Date.now(), 
        trip_id: currentTrip.id, 
        date: selectedDate,
        time: expenseData.time,
        amount: expenseData.amount,
        currency: expenseData.currency,
        category: expenseData.category,
        place: expenseData.place || '',
        paid_by: expenseData.paid_by || 0,
        created_at: new Date().toISOString() 
      };
      const updated = [...expenses, localExpense];
      setExpenses(updated);
      localStorage.setItem(`expenses_${currentTrip.id}_${selectedDate}`, JSON.stringify(updated));
    }
    
    setShowAddModal(false);
    setNewExpense({ hour: '12', minute: '00', amount: '', currency: 'JPY', place: '', category: '', paid_by: 0, split_with: [] });
  };

  // Handle file upload for OCR - uses /ocr/create endpoint
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTrip) {
      console.error('❌ No file or no currentTrip:', { file, currentTrip });
      return;
    }

    console.log('📷 OCR Upload started:', {
      tripId: currentTrip.id,
      date: selectedDate,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    // Show image preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setShowOcrModal(true);
    setOcrLoading(true);
    setOcrItems([]);

    try {
      // Get participant IDs for the expense
      const participantIds = participants.map(p => p.id);
      console.log('🔄 Calling OCR /create API...', { participantIds });
      
      // Use /ocr/create - creates expenses directly with participants
      const createdExpenses = await ocrApi.createFromReceipt(currentTrip.id, selectedDate, file, participantIds);
      console.log('✅ OCR Created Expenses:', createdExpenses);
      
      // Add created expenses to the list
      setExpenses(prev => [...prev, ...createdExpenses]);
      
      // Show results in modal as confirmation
      setOcrItems(createdExpenses.map(exp => ({
        amount: exp.amount,
        currency: exp.currency,
        description: exp.place || exp.category || 'Item',
        date: exp.date,
        selected: true,
      })));
      
      // Auto close modal after success
      setTimeout(() => {
        setShowOcrModal(false);
        setOcrItems([]);
        setUploadedImage(null);
      }, 2000);
      
    } catch (error) {
      console.error('❌ OCR Error:', error);
      
      // Check if it's a server overload error
      const errorMsg = error instanceof Error ? error.message : '';
      if (errorMsg.includes('503') || errorMsg.includes('overload')) {
        alert('⚠️ 서버가 일시적으로 바쁩니다. 잠시 후 다시 시도해주세요.\n(Server is temporarily busy. Please try again in a few seconds.)');
        setShowOcrModal(false);
        setUploadedImage(null);
      } else {
        setOcrItems([{
          amount: 0,
          currency: 'KRW',
          description: 'Unable to read - please enter manually',
          date: null,
          selected: false,
        }]);
      }
    }
    setOcrLoading(false);
  };

  // Save selected OCR items as expenses
  const handleSaveOcrItems = async () => {
    if (!currentTrip) return;
    
    const selectedItems = ocrItems.filter(item => item.selected && item.amount > 0);
    const participantIds = participants.map(p => p.id);
    
    for (const item of selectedItems) {
      const expenseData = {
        time: new Date().toTimeString().slice(0, 5),
        amount: item.amount,
        currency: item.currency,
        category: 'Food',
        place: item.description || null,
        paid_by: null,
        participant_ids: participantIds,
      };

      try {
        const created = await expensesApi.create(currentTrip.id, selectedDate, expenseData);
        setExpenses(prev => [...prev, created]);
      } catch (error) {
        console.warn('Failed to create OCR expense:', error);
        
        // Check if it's a server overload error
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg.includes('503') || errorMsg.includes('overload')) {
          alert('⚠️ 서버가 일시적으로 바쁩니다. 일부 항목이 저장되지 않았습니다.\n(Server is temporarily busy. Some items were not saved.)');
          break; // Stop processing remaining items
        }
        
        // Fallback to local storage for other errors
        const localExpense: Expense = { 
          id: Date.now(), 
          trip_id: currentTrip.id, 
          date: selectedDate,
          time: expenseData.time,
          amount: expenseData.amount,
          currency: expenseData.currency,
          category: expenseData.category,
          place: expenseData.place || '',
          paid_by: 0,
          created_at: new Date().toISOString() 
        };
        setExpenses(prev => [...prev, localExpense]);
      }
    }

    setShowOcrModal(false);
    setOcrItems([]);
    setUploadedImage(null);
  };

  const toggleOcrItem = (index: number) => {
    setOcrItems(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const updateOcrItem = (index: number, field: keyof OcrItem, value: string | number) => {
    setOcrItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const convertToKRW = (amount: number, currency: string) => {
    if (!fxRate) return amount;
    const rates: { [key: string]: number } = {
      'KRW': 1,
      'USD': fxRate.rate,
      'JPY': fxRate.rate / 150,
      'EUR': fxRate.rate * 1.1,
      'CNY': fxRate.rate / 7.2,
      'AUD': fxRate.rate / 1.5,
      'GBP': fxRate.rate * 1.3,
    };
    return Math.round(amount * (rates[currency] || 1));
  };

  const getCategoryEmoji = (category: string) => {
    const cat = CATEGORIES.find(c => c.name.toLowerCase() === category.toLowerCase());
    return cat?.emoji || '📝';
  };

  const toggleSplitWith = (participantId: number) => {
    setNewExpense(prev => ({
      ...prev,
      split_with: prev.split_with.includes(participantId)
        ? prev.split_with.filter(id => id !== participantId)
        : [...prev.split_with, participantId]
    }));
  };

  // Generate hour options (00-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  // Generate minute options (00-59, step 5)
  const minuteOptions = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  if (!currentTrip) {
    return (
      <div className="expense-page">
        <div className="no-trip">
          <p>No trip selected</p>
          <button onClick={() => navigate('/home')}>Go to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="expense-page">
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Header */}
      <header className="expense-header">
        <div className="header-left">
          <span className="logo-check">✓</span>
          <span className="logo-text">CHECKMATE</span>
        </div>
        <button className="close-btn" onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      {/* Title & Actions */}
      <div className="expense-title-bar">
        <div className="title-row">
          <span className="title-text">EXPENSE</span>
          <span className="title-emoji">💰</span>
        </div>
        <div className="action-row">
          <button className="action-btn screenshot" onClick={() => fileInputRef.current?.click()}>
            <span className="icon">📷</span>
            <span>Upload Screenshot</span>
          </button>
          <button className="action-btn manual" onClick={() => setShowAddModal(true)}>
            <span className="icon">✏️</span>
            <span>ADD MANUALLY</span>
          </button>
        </div>
      </div>

      {/* FX Rate */}
      <div className="fx-bar">
        <span className="fx-label">FX RATE</span>
        <span className="fx-value">1 USD =</span>
        <span className="fx-rate">{fxLoading ? '...' : `${fxRate?.rate.toLocaleString() || '---'} KRW`}</span>
        <button className="fx-refresh">🔄</button>
      </div>

      {/* Date */}
      <div className="date-bar">
        <span className="date-icon">📅</span>
        <span className="date-text">{formatDate(selectedDate)}</span>
      </div>

      {/* Expenses List */}
      <div className="expenses-container">
        {loading ? (
          <div className="loading-state">
            <span className="spinner">💰</span>
            <p>Loading expenses...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📝</span>
            <p>No expenses for this day</p>
            <p className="hint">Upload a screenshot or add manually</p>
          </div>
        ) : (
          <div className="expenses-list">
            {expenses.map((expense) => (
              <div key={expense.id} className="expense-card">
                <div className="expense-time">{expense.time}</div>
                <div className="expense-category">{getCategoryEmoji(expense.category)}</div>
                <div className="expense-details">
                  <div className="amount-row">
                    <span className="original">{expense.amount.toLocaleString()} {expense.currency}</span>
                    <span className="arrow">→</span>
                    <span className="converted">{convertToKRW(expense.amount, expense.currency).toLocaleString()} KRW</span>
                  </div>
                  <div className="place">{expense.place || 'No place'}</div>
                </div>
                <div className="payer-info">
                  <span className="payer-name">Me</span>
                  <span className="split-count">👥</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Expense Modal - Figma Style */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="add-expense-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Expense</h3>
              <button className="close-modal" onClick={() => setShowAddModal(false)}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {/* Time - Hour & Minute */}
              <div className="form-section">
                <label>Time</label>
                <div className="time-picker">
                  <select 
                    value={newExpense.hour}
                    onChange={e => setNewExpense({...newExpense, hour: e.target.value})}
                  >
                    {hourOptions.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span className="time-separator">:</span>
                  <select 
                    value={newExpense.minute}
                    onChange={e => setNewExpense({...newExpense, minute: e.target.value})}
                  >
                    {minuteOptions.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Amount & Currency */}
              <div className="form-section">
                <label>Amount & Currency</label>
                <div className="amount-currency-row">
                  <input 
                    type="number"
                    className="amount-input"
                    placeholder="0"
                    value={newExpense.amount}
                    onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                  />
                  <select 
                    className="currency-select"
                    value={newExpense.currency}
                    onChange={e => setNewExpense({...newExpense, currency: e.target.value})}
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Place */}
              <div className="form-section">
                <label>Place</label>
                <input 
                  type="text"
                  className="place-input"
                  placeholder="Where did you spend?"
                  value={newExpense.place}
                  onChange={e => setNewExpense({...newExpense, place: e.target.value})}
                />
              </div>

              {/* Category - 3x3 Grid */}
              <div className="form-section">
                <label>Category</label>
                <div className="category-grid">
                  {CATEGORIES.map(cat => (
                    <button 
                      key={cat.name}
                      className={`category-btn ${newExpense.category === cat.name ? 'active' : ''}`}
                      onClick={() => setNewExpense({...newExpense, category: cat.name})}
                    >
                      <span className="cat-emoji">{cat.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Paid by */}
              <div className="form-section">
                <label>Paid by</label>
                <div className="payer-row">
                  <button 
                    className={`payer-chip ${newExpense.paid_by === 0 ? 'active' : ''}`}
                    onClick={() => setNewExpense({...newExpense, paid_by: 0})}
                  >
                    Me
                  </button>
                  {participants.map(p => (
                    <button 
                      key={p.id}
                      className={`payer-chip ${newExpense.paid_by === p.id ? 'active' : ''}`}
                      onClick={() => setNewExpense({...newExpense, paid_by: p.id})}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split with */}
              <div className="form-section">
                <label>Split with</label>
                <div className="split-row">
                  {participants.length === 0 ? (
                    <span className="no-participants">Add participants to split</span>
                  ) : (
                    participants.map(p => (
                      <label key={p.id} className="split-checkbox">
                        <input 
                          type="checkbox"
                          checked={newExpense.split_with.includes(p.id)}
                          onChange={() => toggleSplitWith(p.id)}
                        />
                        <span className="checkmark"></span>
                        <span className="name">{p.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button 
                className="add-btn"
                onClick={handleAddExpense}
                disabled={!newExpense.amount || !newExpense.category}
              >
                Add Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OCR Modal */}
      {showOcrModal && (
        <div className="modal-backdrop" onClick={() => setShowOcrModal(false)}>
          <div className="ocr-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📷 Screenshot OCR</h3>
              <button className="close-modal" onClick={() => setShowOcrModal(false)}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {uploadedImage && (
                <div className="image-preview">
                  <img src={uploadedImage} alt="Receipt" />
                </div>
              )}

              {ocrLoading ? (
                <div className="ocr-loading">
                  <div className="spinner">🔍</div>
                  <p>Analyzing image...</p>
                </div>
              ) : (
                <div className="ocr-results">
                  <p className="result-count">Found {ocrItems.length} item(s)</p>
                  {ocrItems.map((item, idx) => (
                    <div key={idx} className={`ocr-item ${item.selected ? 'selected' : ''}`}>
                      <button className="select-btn" onClick={() => toggleOcrItem(idx)}>
                        {item.selected ? '✅' : '⬜'}
                      </button>
                      <div className="item-details">
                        <input 
                          className="desc-input"
                          value={item.description}
                          onChange={e => updateOcrItem(idx, 'description', e.target.value)}
                        />
                        <div className="amount-row">
                          <input 
                            type="number"
                            className="amount-input"
                            value={item.amount}
                            onChange={e => updateOcrItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                          />
                          <select 
                            value={item.currency}
                            onChange={e => updateOcrItem(idx, 'currency', e.target.value)}
                          >
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="krw-value">≈ {convertToKRW(item.amount, item.currency).toLocaleString()} KRW</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowOcrModal(false)}>Cancel</button>
              <button 
                className="add-btn"
                onClick={handleSaveOcrItems}
                disabled={ocrLoading || ocrItems.filter(i => i.selected).length === 0}
              >
                Save Selected ({ocrItems.filter(i => i.selected).length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
