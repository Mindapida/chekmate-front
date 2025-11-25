import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import { fxApi, expensesApi, tripsApi, ocrApi } from '../api';
import type { Expense, TripParticipant } from '../types/api';
import './ExpensePage.css';

// Category emoji mapping
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
const CURRENCIES = ['KRW', 'USD', 'JPY', 'EUR', 'CNY', 'AUD'];

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
    time: '',
    amount: '',
    currency: 'JPY',
    place: '',
    category: '',
    paid_by: 0,
  });

  // OCR states
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Load exchange rate
  useEffect(() => {
    const loadFxRate = async () => {
      setFxLoading(true);
      try {
        const data = await fxApi.getRate('USD', 'KRW', selectedDate);
        setFxRate({ rate: data.rate, from: data.from_currency, to: data.to_currency });
      } catch (error) {
        console.warn('Failed to load FX rate, using fallback');
        setFxRate({ rate: 1355, from: 'USD', to: 'KRW' });
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
          expensesApi.getByTrip(currentTrip.id, selectedDate),
          tripsApi.getParticipants(currentTrip.id),
        ]);
        setExpenses(expData);
        setParticipants(partData);
      } catch (error) {
        console.warn('Failed to load data, using local storage');
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
    if (!currentTrip || !newExpense.time || !newExpense.amount || !newExpense.category) return;
    
    const expense: Omit<Expense, 'id' | 'trip_id' | 'created_at'> = {
      date: selectedDate,
      time: newExpense.time,
      amount: parseFloat(newExpense.amount),
      currency: newExpense.currency,
      category: newExpense.category,
      place: newExpense.place,
      paid_by: newExpense.paid_by || 0,
    };

    try {
      const created = await expensesApi.create(currentTrip.id, expense);
      setExpenses([...expenses, created]);
    } catch (error) {
      const localExpense = { ...expense, id: Date.now(), trip_id: currentTrip.id, created_at: new Date().toISOString() };
      const updated = [...expenses, localExpense as Expense];
      setExpenses(updated);
      localStorage.setItem(`expenses_${currentTrip.id}_${selectedDate}`, JSON.stringify(updated));
    }
    
    setShowAddModal(false);
    setNewExpense({ time: '', amount: '', currency: 'JPY', place: '', category: '', paid_by: 0 });
  };

  // Handle file upload for OCR
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTrip) return;

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
      const results = await ocrApi.parseReceipt(currentTrip.id, selectedDate, file);
      setOcrItems(results.map(item => ({ ...item, selected: true })));
    } catch (error) {
      console.warn('OCR failed, showing manual entry');
      // Fallback: show empty items for manual entry
      setOcrItems([{
        amount: 0,
        currency: 'KRW',
        description: 'Unable to read - please enter manually',
        date: null,
        selected: false,
      }]);
    }
    setOcrLoading(false);
  };

  // Save selected OCR items as expenses
  const handleSaveOcrItems = async () => {
    if (!currentTrip) return;
    
    const selectedItems = ocrItems.filter(item => item.selected && item.amount > 0);
    
    for (const item of selectedItems) {
      const expense: Omit<Expense, 'id' | 'trip_id' | 'created_at'> = {
        date: selectedDate,
        time: new Date().toTimeString().slice(0, 5),
        amount: item.amount,
        currency: item.currency,
        category: 'Food', // Default category
        place: item.description,
        paid_by: 0,
      };

      try {
        const created = await expensesApi.create(currentTrip.id, expense);
        setExpenses(prev => [...prev, created]);
      } catch (error) {
        const localExpense = { ...expense, id: Date.now(), trip_id: currentTrip.id, created_at: new Date().toISOString() };
        setExpenses(prev => [...prev, localExpense as Expense]);
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
    };
    return Math.round(amount * (rates[currency] || 1));
  };

  const getCategoryEmoji = (category: string) => {
    const cat = CATEGORIES.find(c => c.name.toLowerCase() === category.toLowerCase());
    return cat?.emoji || '📝';
  };

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
        <button className="back-btn" onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="header-title">EXPENSE 💰</div>
        <div style={{ width: 36 }}></div>
      </header>

      {/* FX Rate */}
      <div className="fx-bar">
        <span className="fx-icon">💱</span>
        <span className="fx-text">
          {fxLoading ? 'Loading...' : `1 USD = ${fxRate?.rate.toLocaleString() || '---'} KRW`}
        </span>
      </div>

      {/* Date & Actions */}
      <div className="date-actions">
        <div className="current-date">
          <span>📅</span>
          <span>{formatDate(selectedDate)}</span>
        </div>
        <div className="action-btns">
          <button className="action-btn upload" onClick={() => fileInputRef.current?.click()}>
            📷 Screenshot
          </button>
          <button className="action-btn manual" onClick={() => setShowAddModal(true)}>
            ✏️ Manual
          </button>
        </div>
      </div>

      {/* Expenses List */}
      <div className="expenses-container">
        {loading ? (
          <div className="loading-state">
            <span>💰</span>
            <p>Loading expenses...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <span>📝</span>
            <p>No expenses for this day</p>
            <p className="hint">Upload a bank screenshot or add manually</p>
          </div>
        ) : (
          <div className="expenses-list">
            {expenses.map((expense) => (
              <div key={expense.id} className="expense-item">
                <div className="expense-icon">{getCategoryEmoji(expense.category)}</div>
                <div className="expense-info">
                  <div className="expense-place">{expense.place || 'Unknown'}</div>
                  <div className="expense-time">{expense.time}</div>
                </div>
                <div className="expense-amount">
                  <div className="amount-original">
                    {expense.amount.toLocaleString()} {expense.currency}
                  </div>
                  <div className="amount-krw">
                    ≈ {convertToKRW(expense.amount, expense.currency).toLocaleString()} KRW
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Add Expense</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="input-group">
                <label>Time</label>
                <input 
                  type="time" 
                  value={newExpense.time}
                  onChange={e => setNewExpense({...newExpense, time: e.target.value})}
                />
              </div>

              <div className="input-group">
                <label>Amount</label>
                <div className="amount-input">
                  <input 
                    type="number" 
                    placeholder="0"
                    value={newExpense.amount}
                    onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                  />
                  <select 
                    value={newExpense.currency}
                    onChange={e => setNewExpense({...newExpense, currency: e.target.value})}
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label>Place</label>
                <input 
                  type="text" 
                  placeholder="Where did you spend?"
                  value={newExpense.place}
                  onChange={e => setNewExpense({...newExpense, place: e.target.value})}
                />
              </div>

              <div className="input-group">
                <label>Category</label>
                <div className="category-select">
                  {CATEGORIES.map(cat => (
                    <button 
                      key={cat.name}
                      className={`cat-btn ${newExpense.category === cat.name ? 'active' : ''}`}
                      onClick={() => setNewExpense({...newExpense, category: cat.name})}
                    >
                      {cat.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label>Paid by</label>
                <div className="payer-select">
                  <button 
                    className={`payer-btn ${newExpense.paid_by === 0 ? 'active' : ''}`}
                    onClick={() => setNewExpense({...newExpense, paid_by: 0})}
                  >
                    Me
                  </button>
                  {participants.map(p => (
                    <button 
                      key={p.id}
                      className={`payer-btn ${newExpense.paid_by === p.id ? 'active' : ''}`}
                      onClick={() => setNewExpense({...newExpense, paid_by: p.id})}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-save" onClick={handleAddExpense}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* OCR Modal */}
      {showOcrModal && (
        <div className="modal-overlay" onClick={() => setShowOcrModal(false)}>
          <div className="modal-box ocr-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📷 Screenshot OCR</h3>
              <button onClick={() => setShowOcrModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Image Preview */}
              {uploadedImage && (
                <div className="image-preview">
                  <img src={uploadedImage} alt="Uploaded receipt" />
                </div>
              )}

              {/* OCR Results */}
              {ocrLoading ? (
                <div className="ocr-loading">
                  <div className="spinner">🔍</div>
                  <p>Analyzing image...</p>
                </div>
              ) : (
                <div className="ocr-results">
                  <p className="results-title">Found {ocrItems.length} item(s)</p>
                  {ocrItems.map((item, idx) => (
                    <div key={idx} className={`ocr-item ${item.selected ? 'selected' : ''}`}>
                      <button 
                        className="select-btn"
                        onClick={() => toggleOcrItem(idx)}
                      >
                        {item.selected ? '✅' : '⬜'}
                      </button>
                      <div className="ocr-item-details">
                        <input 
                          className="ocr-desc"
                          value={item.description}
                          onChange={e => updateOcrItem(idx, 'description', e.target.value)}
                          placeholder="Description"
                        />
                        <div className="ocr-amount-row">
                          <input 
                            type="number"
                            className="ocr-amount"
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
                        <div className="ocr-krw">
                          ≈ {convertToKRW(item.amount, item.currency).toLocaleString()} KRW
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowOcrModal(false)}>Cancel</button>
              <button 
                className="btn-save" 
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
