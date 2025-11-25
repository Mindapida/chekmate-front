import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import { fxApi, expensesApi, tripsApi } from '../api';
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
const CURRENCIES = ['KRW', 'USD', 'JPY', 'EUR', 'CNY'];

export default function ExpensePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentTrip } = useTrips();
  
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(dateParam);
  
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

  // Load exchange rate
  useEffect(() => {
    const loadFxRate = async () => {
      setFxLoading(true);
      try {
        const data = await fxApi.getRate('USD', 'KRW', selectedDate);
        setFxRate({ rate: data.rate, from: data.from_currency, to: data.to_currency });
      } catch (error) {
        console.warn('Failed to load FX rate, using fallback');
        // Fallback rate
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
        // Load from localStorage as fallback
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
      // Fallback: save locally
      const localExpense = { ...expense, id: Date.now(), trip_id: currentTrip.id, created_at: new Date().toISOString() };
      const updated = [...expenses, localExpense as Expense];
      setExpenses(updated);
      localStorage.setItem(`expenses_${currentTrip.id}_${selectedDate}`, JSON.stringify(updated));
    }
    
    setShowAddModal(false);
    setNewExpense({ time: '', amount: '', currency: 'JPY', place: '', category: '', paid_by: 0 });
  };

  const convertToKRW = (amount: number, currency: string) => {
    if (!fxRate) return amount;
    // Simple conversion (in real app, use proper rates)
    const rates: { [key: string]: number } = {
      'KRW': 1,
      'USD': fxRate.rate,
      'JPY': fxRate.rate / 150, // Approximate
      'EUR': fxRate.rate * 1.1,
      'CNY': fxRate.rate / 7.2,
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
      {/* Header */}
      <header className="expense-header">
        <div className="header-left">
          <div className="header-logo">
            <span className="logo-check">✓</span>
            <span className="logo-text">CHECKMATE</span>
          </div>
        </div>
        <button className="back-btn" onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 4L16 16M4 16L16 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      {/* Title Section */}
      <div className="expense-title-section">
        <div className="expense-title">
          <span>EXPENSE</span>
          <span className="title-emoji">💰</span>
        </div>
        <div className="expense-actions">
          <button className="upload-btn">
            <span>📷</span>
            <span>Upload Screenshot</span>
          </button>
          <button className="add-btn" onClick={() => setShowAddModal(true)}>
            <span>✏️</span>
            <span>ADD MANUALLY</span>
          </button>
        </div>
      </div>

      {/* FX Rate Section */}
      <div className="fx-rate-section">
        <span className="fx-label">FX RATE</span>
        <span className="fx-value">
          {fxLoading ? '...' : `1 USD = ${fxRate?.rate.toLocaleString() || '---'} KRW`}
        </span>
        <button className="fx-refresh" onClick={() => setFxLoading(true)}>
          🔄
        </button>
      </div>

      {/* Date Section */}
      <div className="date-section">
        <span className="date-icon">📅</span>
        <span className="date-value">{formatDate(selectedDate)}</span>
      </div>

      {/* Expenses List */}
      <div className="expenses-list">
        {loading ? (
          <div className="loading">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="empty-expenses">
            <span className="empty-icon">📝</span>
            <p>No expenses for this day</p>
            <button onClick={() => setShowAddModal(true)}>+ Add Expense</button>
          </div>
        ) : (
          expenses.map((expense) => (
            <div key={expense.id} className="expense-card">
              <div className="expense-time">{expense.time}</div>
              <div className="expense-category">{getCategoryEmoji(expense.category)}</div>
              <div className="expense-details">
                <div className="expense-amount-row">
                  <span className="expense-original">
                    {expense.amount.toLocaleString()} {expense.currency}
                  </span>
                  <span className="expense-arrow">→</span>
                  <span className="expense-converted">
                    {convertToKRW(expense.amount, expense.currency).toLocaleString()} KRW
                  </span>
                </div>
                <div className="expense-place">{expense.place || 'No place'}</div>
              </div>
              <div className="expense-payer">
                <span className="payer-avatar">👤</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Expense</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Time */}
              <div className="form-group">
                <label>Time</label>
                <input 
                  type="time" 
                  value={newExpense.time}
                  onChange={e => setNewExpense({...newExpense, time: e.target.value})}
                />
              </div>

              {/* Amount & Currency */}
              <div className="form-group">
                <label>Amount & Currency</label>
                <div className="amount-row">
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

              {/* Place */}
              <div className="form-group">
                <label>Place</label>
                <input 
                  type="text" 
                  placeholder="Where did you spend?"
                  value={newExpense.place}
                  onChange={e => setNewExpense({...newExpense, place: e.target.value})}
                />
              </div>

              {/* Category */}
              <div className="form-group">
                <label>Category</label>
                <div className="category-grid">
                  {CATEGORIES.map(cat => (
                    <button 
                      key={cat.name}
                      className={`category-btn ${newExpense.category === cat.name ? 'active' : ''}`}
                      onClick={() => setNewExpense({...newExpense, category: cat.name})}
                    >
                      {cat.emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paid by */}
              <div className="form-group">
                <label>Paid by</label>
                <div className="payer-list">
                  {participants.length > 0 ? (
                    participants.map(p => (
                      <button 
                        key={p.id}
                        className={`payer-btn ${newExpense.paid_by === p.id ? 'active' : ''}`}
                        onClick={() => setNewExpense({...newExpense, paid_by: p.id})}
                      >
                        {p.name}
                      </button>
                    ))
                  ) : (
                    <button 
                      className={`payer-btn ${newExpense.paid_by === 0 ? 'active' : ''}`}
                      onClick={() => setNewExpense({...newExpense, paid_by: 0})}
                    >
                      Me
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="submit-btn" onClick={handleAddExpense}>Add Expense</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

