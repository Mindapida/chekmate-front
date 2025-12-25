import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTrips } from '../context/TripContext';
import { budgetApi, expensesApi } from '../api';
import type { Expense } from '../types/api';
import BottomNav, { saveLastPage } from '../components/BottomNav';
import './MyPage.css';

// Storage keys
const BUDGET_STORAGE_KEY = 'trip_budget';
const EXPENSE_STORAGE_KEY = 'expenses';

// Category mapping with emojis (keys match ExpensePage category names - lowercase)
const CATEGORY_MAP: { [key: string]: { name: string; emoji: string } } = {
  'food': { name: 'Food & Dining', emoji: '🍽️' },
  'drinks': { name: 'Drinks', emoji: '🍺' },
  'transport': { name: 'Transportation', emoji: '🚗' },
  'hotel': { name: 'Accommodation', emoji: '🏨' },
  'shopping': { name: 'Shopping', emoji: '🛍️' },
  'activity': { name: 'Activities', emoji: '🎭' },
  'ticket': { name: 'Tickets', emoji: '🎫' },
  'gift': { name: 'Gifts', emoji: '🎁' },
  'cafe': { name: 'Cafe', emoji: '☕' },
};

// Normalize category name to match CATEGORY_MAP keys
const normalizeCategory = (category: string): string => {
  return category.toLowerCase().trim();
};

// Currency symbols
const CURRENCY_SYMBOLS: { [key: string]: string } = {
  'KRW': '₩',
  'USD': '$',
  'JPY': '¥',
  'EUR': '€',
  'GBP': '£',
  'CNY': '¥',
  'AUD': 'A$',
};

// Approximate exchange rates to USD (for conversion)
const EXCHANGE_RATES_TO_USD: { [key: string]: number } = {
  'USD': 1,
  'KRW': 0.00072,  // 1 KRW = 0.00072 USD
  'JPY': 0.0064,   // 1 JPY = 0.0064 USD
  'EUR': 1.04,     // 1 EUR = 1.04 USD
  'GBP': 1.25,     // 1 GBP = 1.25 USD
  'CNY': 0.14,     // 1 CNY = 0.14 USD
  'AUD': 0.62,     // 1 AUD = 0.62 USD
};

// Convert amount from one currency to another
const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string): number => {
  if (fromCurrency === toCurrency) return amount;
  
  // Convert to USD first, then to target currency
  const toUsdRate = EXCHANGE_RATES_TO_USD[fromCurrency] || 1;
  const fromUsdRate = EXCHANGE_RATES_TO_USD[toCurrency] || 1;
  
  const amountInUsd = amount * toUsdRate;
  return amountInUsd / fromUsdRate;
};

interface CategorySpending {
  category: string;
  name: string;
  emoji: string;
  amount: number;
  percentage: number;
}

interface BudgetData {
  amount: number;
  currency: string;
}

export default function MyPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentTrip, trips } = useTrips();

  // Budget state
  const [budget, setBudget] = useState<BudgetData>({ amount: 0, currency: 'USD' });
  const [totalSpent, setTotalSpent] = useState(0);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [loading, setLoading] = useState(false);

  // Budget edit modal state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editBudgetAmount, setEditBudgetAmount] = useState('');
  const [editBudgetCurrency, setEditBudgetCurrency] = useState('USD');

  // Save current page on mount
  useEffect(() => {
    saveLastPage('/mypage');
  }, []);

  // Load budget data
  const loadBudget = useCallback(async () => {
    if (!currentTrip) return;

    // Try to load from backend first
    try {
      const backendBudget = await budgetApi.get(currentTrip.id);
      setBudget({ amount: backendBudget.amount, currency: backendBudget.currency });
      return;
    } catch (error) {
      console.log('Backend budget not available, using localStorage');
    }

    // Fallback to localStorage
    const stored = localStorage.getItem(`${BUDGET_STORAGE_KEY}_${currentTrip.id}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      setBudget(parsed);
    } else {
      setBudget({ amount: 0, currency: 'USD' });
    }
  }, [currentTrip]);

  // Load expenses and calculate categories (converts to budget currency)
  const loadExpenses = useCallback(async () => {
    if (!currentTrip) return;

    const allExpenses: Expense[] = [];

    // Get date range for current trip
    const startDate = new Date(currentTrip.start_date);
    const endDate = new Date(currentTrip.end_date);
    const today = new Date();

    console.log('📊 Loading expenses for trip:', currentTrip.name);
    console.log('📅 Date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
    console.log('💱 Budget currency:', budget.currency);

    // Iterate through each day of the trip
    const currentDate = new Date(startDate);
    while (currentDate <= endDate && currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Try to load from backend API first
      try {
        const backendExpenses = await expensesApi.getByDate(currentTrip.id, dateStr);
        if (backendExpenses && backendExpenses.length > 0) {
          console.log(`💰 [Backend] Found ${backendExpenses.length} expenses for ${dateStr}`);
          allExpenses.push(...backendExpenses);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
      } catch (error) {
        console.log(`⚠️ Backend failed for ${dateStr}, trying localStorage...`);
      }
      
      // Fallback to localStorage
      const storageKey = `${EXPENSE_STORAGE_KEY}_${currentTrip.id}_${dateStr}`;
      const storedExpenses = localStorage.getItem(storageKey);
      
      if (storedExpenses) {
        try {
          const dayExpenses = JSON.parse(storedExpenses);
          console.log(`💰 [Local] Found ${dayExpenses.length} expenses for ${dateStr}`);
          allExpenses.push(...dayExpenses);
        } catch (e) {
          console.error('Failed to parse expenses for', dateStr, e);
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log('📊 Total expenses loaded:', allExpenses.length);
    console.log('📊 All expenses:', allExpenses);

    // Calculate total spending - convert all expenses to budget currency
    let totalInBudgetCurrency = 0;
    allExpenses.forEach(exp => {
      const expAmount = typeof exp.amount === 'number' ? exp.amount : parseFloat(exp.amount) || 0;
      const expCurrency = exp.currency || 'USD';
      const convertedAmount = convertCurrency(expAmount, expCurrency, budget.currency);
      totalInBudgetCurrency += convertedAmount;
      console.log(`  💵 ${expAmount} ${expCurrency} → ${convertedAmount.toFixed(2)} ${budget.currency}`);
    });
    
    // Round to 2 decimal places
    const roundedTotal = Math.round(totalInBudgetCurrency * 100) / 100;
    console.log('📊 Total spent (in', budget.currency + '):', roundedTotal);
    setTotalSpent(roundedTotal);

    // Calculate spending by category (also in budget currency)
    const categoryTotals: { [key: string]: number } = {};
    allExpenses.forEach(exp => {
      if (exp.category) {
        const cat = normalizeCategory(exp.category);
        const expAmount = typeof exp.amount === 'number' ? exp.amount : parseFloat(exp.amount) || 0;
        const expCurrency = exp.currency || 'USD';
        const convertedAmount = convertCurrency(expAmount, expCurrency, budget.currency);
        categoryTotals[cat] = (categoryTotals[cat] || 0) + convertedAmount;
      }
    });

    console.log('📊 Category totals (in', budget.currency + '):', categoryTotals);

    // Sort by amount and get top 3
    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat, amount]) => {
        const info = CATEGORY_MAP[cat] || { name: cat.charAt(0).toUpperCase() + cat.slice(1), emoji: '📝' };
        const percentage = totalInBudgetCurrency > 0 ? Math.round((amount / totalInBudgetCurrency) * 100) : 0;
        return {
          category: cat,
          name: info.name,
          emoji: info.emoji,
          amount: Math.round(amount * 100) / 100,
          percentage,
        };
      });

    console.log('📊 Top categories:', sortedCategories);
    setCategorySpending(sortedCategories);
  }, [currentTrip, budget.currency]);

  // Load data on mount and when trip changes
  useEffect(() => {
    const loadData = async () => {
      if (currentTrip) {
        setLoading(true);
        await loadBudget();
        await loadExpenses();
        setLoading(false);
      }
    };
    loadData();
  }, [currentTrip, loadBudget, loadExpenses]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Open budget edit modal
  const openBudgetModal = () => {
    setEditBudgetAmount(budget.amount > 0 ? budget.amount.toString() : '');
    setEditBudgetCurrency(budget.currency);
    setShowBudgetModal(true);
  };

  // Save budget
  const handleSaveBudget = async () => {
    if (!currentTrip) return;

    const newAmount = parseFloat(editBudgetAmount) || 0;
    const newBudget = { amount: newAmount, currency: editBudgetCurrency };

    // Try to save to backend
    try {
      await budgetApi.set(currentTrip.id, newAmount, editBudgetCurrency);
    } catch (error) {
      console.log('Backend save failed, saving to localStorage only');
    }

    // Always save to localStorage as backup
    localStorage.setItem(`${BUDGET_STORAGE_KEY}_${currentTrip.id}`, JSON.stringify(newBudget));
    setBudget(newBudget);
    setShowBudgetModal(false);
  };

  // Calculate remaining and percentage
  const remaining = budget.amount - totalSpent;
  const percentage = budget.amount > 0 ? Math.round((totalSpent / budget.amount) * 100) : 0;
  const currencySymbol = CURRENCY_SYMBOLS[budget.currency] || budget.currency;

  // Format amount for display
  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
    return amount.toLocaleString();
  };

  // Rank medals
  const rankMedals = ['🥇', '🥈', '🥉'];

  return (
    <div className="mypage">
      <div className="page-content">
        <header className="page-header">
          <div className="header-left">
            <div className="header-logo">
              <span className="logo-check">✓</span>
              <span className="logo-text">CHECKMATE</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H6M10.6667 11.3333L14 8M14 8L10.6667 4.66667M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Logout
          </button>
        </header>

        <div className="welcome-bar">
          Welcome, {user?.username || 'Guest'} 👋
        </div>

        {currentTrip && (
          <div className="current-trip-banner">
            <span>✈️</span>
            <span>Current Trip: {currentTrip.name}</span>
          </div>
        )}

        <div className="budget-section">
          <div className="section-header">
            <h2>My Budget</h2>
            <button className="edit-btn" onClick={openBudgetModal}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M11.334 2.00004C11.5091 1.82494 11.7169 1.68605 11.9457 1.59129C12.1745 1.49653 12.4197 1.44775 12.6673 1.44775C12.915 1.44775 13.1602 1.49653 13.389 1.59129C13.6178 1.68605 13.8256 1.82494 14.0007 2.00004C14.1758 2.17513 14.3147 2.383 14.4094 2.61178C14.5042 2.84055 14.553 3.08575 14.553 3.33337C14.553 3.58099 14.5042 3.82619 14.4094 4.05497C14.3147 4.28374 14.1758 4.49161 14.0007 4.66671L5.00065 13.6667L1.33398 14.6667L2.33398 11L11.334 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Edit
            </button>
          </div>

          {budget.amount === 0 ? (
            <div className="no-budget">
              <span className="no-budget-icon">💰</span>
              <p>No budget set yet</p>
              <button className="set-budget-btn" onClick={openBudgetModal}>
                Set Budget
              </button>
            </div>
          ) : (
            <>
              <div className="budget-stats">
                <div className="stat-box">
                  <span className="stat-label">Budget</span>
                  <span className="stat-value">{formatAmount(budget.amount)} {currencySymbol}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Spending</span>
                  <span className="stat-value">{formatAmount(totalSpent)} {currencySymbol}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Remaining</span>
                  <span className={`stat-value ${remaining >= 0 ? 'green' : 'red'}`}>
                    {formatAmount(Math.abs(remaining))} {currencySymbol}
                    {remaining < 0 && ' over'}
                  </span>
                </div>
              </div>

              <div className="budget-visual">
                <div className="coin">
                  <div className="coin-inner">
                    <span className="currency">{currencySymbol}</span>
                    <span className="percent">{Math.min(percentage, 100)}%</span>
                  </div>
                  <svg className="progress-ring" viewBox="0 0 120 120">
                    <circle className="progress-bg" cx="60" cy="60" r="54" />
                    <circle 
                      className={`progress-bar ${percentage > 100 ? 'over-budget' : ''}`}
                      cx="60" 
                      cy="60" 
                      r="54"
                      style={{ strokeDashoffset: 339.3 - (339.3 * Math.min(percentage, 100) / 100) }}
                    />
                  </svg>
                </div>
                <div className="budget-info">
                  <span>{percentage}% used</span>
                  <span className={`remaining ${remaining < 0 ? 'over' : ''}`}>
                    {remaining >= 0 ? `${remaining.toLocaleString()} ${budget.currency} left` : `${Math.abs(remaining).toLocaleString()} ${budget.currency} over budget!`}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="categories-section">
          <h2>Top Spending Categories</h2>
          
          {loading ? (
            <div className="loading-categories">Loading...</div>
          ) : categorySpending.length === 0 ? (
            <div className="no-categories">
              <span className="no-data-icon">📊</span>
              <p>No expenses recorded yet</p>
              <p className="hint">Add expenses in the Calendar to see your spending breakdown</p>
            </div>
          ) : (
            categorySpending.map((cat, index) => (
              <div key={cat.category} className="category">
                <span className="rank">{rankMedals[index]}</span>
                <div className="category-info">
                  <div className="cat-header">
                    <span className="cat-emoji">{cat.emoji}</span>
                    <span className="cat-name">{cat.name}</span>
                    <span className="cat-amount">{formatAmount(cat.amount)} {currencySymbol}</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${cat.percentage}%` }}></div>
                    </div>
                    <span className="cat-percent">{cat.percentage}%</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="trips-summary">
          <h3>Total Trips: {trips.length}</h3>
        </div>
      </div>

      {/* Budget Edit Modal */}
      {showBudgetModal && (
        <div className="modal-overlay" onClick={() => setShowBudgetModal(false)}>
          <div className="budget-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💰 Set Budget</h3>
              <button className="modal-close" onClick={() => setShowBudgetModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="input-group">
                <label>Amount</label>
                <input
                  type="number"
                  placeholder="Enter budget amount"
                  value={editBudgetAmount}
                  onChange={(e) => setEditBudgetAmount(e.target.value)}
                  autoFocus
                />
              </div>
              
              <div className="input-group">
                <label>Currency</label>
                <div className="currency-buttons">
                  {['USD', 'KRW', 'JPY', 'EUR', 'GBP', 'CNY'].map(curr => (
                    <button
                      key={curr}
                      className={`currency-btn ${editBudgetCurrency === curr ? 'active' : ''}`}
                      onClick={() => setEditBudgetCurrency(curr)}
                    >
                      {CURRENCY_SYMBOLS[curr]} {curr}
                    </button>
                  ))}
                </div>
              </div>
              
              {currentTrip && (
                <div className="budget-hint">
                  <span>📅</span>
                  <span>Budget for: {currentTrip.name}</span>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowBudgetModal(false)}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSaveBudget}>
                Save Budget
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav activeTab="mypage" />
    </div>
  );
}




