import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
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
  const { user } = useAuth();
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
    currency: 'USD',
    place: '',
    category: '',
    paid_by: 0,
    split_with: [] as number[],
  });

  // Initialize paid_by and split_with when modal opens
  const openAddModal = () => {
    // Find current user - use user_id field from participant or match by username
    const myParticipant = participants.find(p => 
      (p as any).user_id === user?.id || (p as any).username === user?.username
    );
    // Use user_id if available, otherwise use participant id, finally fallback to user.id
    const myUserId = (myParticipant as any)?.user_id || myParticipant?.id || user?.id || 0;
    
    console.log('📋 openAddModal - user:', user?.id, 'participant:', myParticipant, 'myUserId:', myUserId);
    
    setNewExpense({
      hour: '12',
      minute: '00',
      amount: '',
      currency: 'USD',
      place: '',
      category: '',
      paid_by: myUserId,
      split_with: myUserId ? [myUserId] : [], // Default: only payer (÷1)
    });
    setShowAddModal(true);
  };

  // OCR states
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Split selection state (for inline editing)
  const [editingSplitId, setEditingSplitId] = useState<number | null>(null);
  const [expenseSplits, setExpenseSplits] = useState<{ [expenseId: number]: number[] }>({});
  
  // Expense detail editing state
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingPlace, setEditingPlace] = useState('');
  const [editingTime, setEditingTime] = useState('');
  const [editingHour, setEditingHour] = useState('12');
  const [editingMinute, setEditingMinute] = useState('00');

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
      
      // Load expenses
      try {
        console.log('📊 Loading expenses for trip:', currentTrip.id, 'date:', selectedDate);
        const expData = await expensesApi.getByDate(currentTrip.id, selectedDate);
        console.log('📊 Loaded expenses from API:', expData.length, 'items', expData);
        setExpenses(expData);
        
        // Initialize expenseSplits from backend participant data
        const newSplits: { [expenseId: number]: number[] } = {};
        expData.forEach(exp => {
          if (exp.participants && exp.participants.length > 0) {
            // Use participant user_ids from backend
            newSplits[exp.id] = exp.participants.map(p => p.user_id);
          }
        });
        if (Object.keys(newSplits).length > 0) {
          setExpenseSplits(prev => ({ ...prev, ...newSplits }));
        }
      } catch (error: any) {
        console.error('❌ Failed to load expenses from API:', error);
        console.error('❌ Error status:', error?.response?.status || error?.message);
        // If 403, user is not a participant of this trip
        if (error?.message?.includes('403') || error?.response?.status === 403) {
          console.error('🚫 Access denied - user may not be a participant of this trip');
        }
        const stored = localStorage.getItem(`expenses_${currentTrip.id}_${selectedDate}`);
        if (stored) setExpenses(JSON.parse(stored));
      }
      
      // Load participants - check localStorage first (where TripDetailPage saves them)
      // Then try API as backup
      let allParticipants: TripParticipant[] = [];
      
      // 1. Load from localStorage (primary source for locally added participants)
      const storedParticipants = localStorage.getItem(`trip_participants_${currentTrip.id}`);
      if (storedParticipants) {
        try {
          const parsed = JSON.parse(storedParticipants);
          console.log('📋 Loaded participants from localStorage:', parsed);
          // Normalize participant data - ensure 'name' and 'user_id' fields exist
          const normalized = parsed.map((p: { id: number; name?: string; username?: string; user_id?: number }) => ({
            id: p.id,
            name: p.name || p.username || `User ${p.id}`,
            username: p.username,
            user_id: p.user_id || p.id, // Use user_id if available, else use id
            trip_id: currentTrip.id,
          }));
          allParticipants = normalized;
        } catch (e) {
          console.warn('Failed to parse localStorage participants:', e);
        }
      }
      
      // 2. Try API as additional source
      try {
        const partData = await tripsApi.getParticipants(currentTrip.id);
        if (partData && partData.length > 0) {
          // Merge with localStorage participants (avoid duplicates by ID)
          const existingIds = new Set(allParticipants.map(p => p.id));
          const newFromApi = partData.filter(p => !existingIds.has(p.id));
          allParticipants = [...allParticipants, ...newFromApi];
        }
      } catch (error) {
        console.warn('Failed to load participants from API:', error);
      }
      
      console.log('📋 Final participants list:', allParticipants);
      setParticipants(allParticipants);
      
      setLoading(false);
    };
    loadData();
  }, [currentTrip, selectedDate]);

  const handleBack = () => navigate('/calendar');

  const formatDate = (date: string) => {
    // Parse date string manually to avoid timezone issues
    // date format: "YYYY-MM-DD"
    const [year, month, day] = date.split('-').map(Number);
    return `${month.toString().padStart(2, '0')}.${day.toString().padStart(2, '0')}.${year}`;
  };

  const handleAddExpense = async () => {
    if (!currentTrip || !newExpense.amount || !newExpense.category) return;
    
    const time = `${newExpense.hour.padStart(2, '0')}:${newExpense.minute.padStart(2, '0')}`;
    
    // Get user_ids for participants (use user_id field if available, else id)
    const getParticipantUserIds = () => {
      return participants.map(p => (p as any).user_id || p.id);
    };
    
    // Backend expects: no date (it's in URL), and participant_ids is required
    const expenseData = {
      time: time,
      amount: parseFloat(newExpense.amount),
      currency: newExpense.currency,
      category: newExpense.category,
      place: newExpense.place || null,
      paid_by: newExpense.paid_by || user?.id || null,
      // Use selected participants or all participants if none selected
      participant_ids: newExpense.split_with.length > 0 
        ? newExpense.split_with 
        : getParticipantUserIds(),
    };
    
    console.log('💰 handleAddExpense - expenseData:', expenseData);

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
    setNewExpense({ hour: '12', minute: '00', amount: '', currency: 'USD', place: '', category: '', paid_by: 0, split_with: [] });
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
      
      // Mark all OCR-created expenses as paid by current user (uploader)
      const expensesWithPayer = createdExpenses.map(exp => ({
        ...exp,
        payer_id: exp.payer_id || user?.id,
        payer_username: exp.payer_username || user?.username,
      }));
      
      // Add created expenses to the list
      setExpenses(prev => [...prev, ...expensesWithPayer]);
      
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
    
    // Find current user's participant ID (uploader = payer)
    const myParticipant = participants.find(p => 
      p.id === user?.id || (p as any).username === user?.username
    );
    const myId = myParticipant?.id || user?.id || null;
    
    for (const item of selectedItems) {
      const expenseData = {
        time: new Date().toTimeString().slice(0, 5),
        amount: item.amount,
        currency: item.currency,
        category: 'Food',
        place: item.description || null,
        paid_by: myId, // Uploader is the payer
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
          paid_by: myId || 0,
          payer_id: myId || undefined,
          payer_username: user?.username,
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

  // Format split summary text - Equal split where payer covers remainder
  // e.g., 10,000 KRW / 3 = 3,333 each, payer pays 3,334 (extra 1 KRW)
  const formatSplitSummary = (totalAmount: number, numPeople: number, currency: string) => {
    if (numPeople <= 0) return '';
    const baseAmount = Math.floor(totalAmount / numPeople);
    const remainder = totalAmount - (baseAmount * numPeople);
    
    if (remainder === 0) {
      return `Each pays: ${baseAmount.toLocaleString()} ${currency}`;
    }
    return `Each pays: ${baseAmount.toLocaleString()} ${currency} (payer +${remainder} ${currency})`;
  };

  const toggleSplitWith = (participantId: number) => {
    // Payer cannot be unchecked
    if (participantId === newExpense.paid_by) return;
    
    setNewExpense(prev => ({
      ...prev,
      split_with: prev.split_with.includes(participantId)
        ? prev.split_with.filter(id => id !== participantId)
        : [...prev.split_with, participantId]
    }));
  };

  // When payer changes, automatically add them to split_with
  const handlePayerChange = (payerId: number) => {
    setNewExpense(prev => {
      // Remove old payer from split_with if they were only there as payer
      const withoutOldPayer = prev.split_with.filter(id => id !== prev.paid_by);
      // Add new payer to split_with
      const newSplitWith = [...withoutOldPayer, payerId];
      
      return {
        ...prev,
        paid_by: payerId,
        split_with: [...new Set(newSplitWith)], // Remove duplicates
      };
    });
  };

  // Toggle split for existing expense (inline editing)
  const toggleExpenseSplit = async (expenseId: number, participantId: number, payerId?: number) => {
    // Payer cannot be unchecked
    if (payerId && participantId === payerId) return;
    
    const currentSplits = expenseSplits[expenseId] || [];
    const newSplits = currentSplits.includes(participantId)
      ? currentSplits.filter(id => id !== participantId)
      : [...currentSplits, participantId];
    
    // Update local state immediately for responsive UI
    setExpenseSplits(prev => {
      const allSplits = { ...prev, [expenseId]: newSplits };
      
      // Save to localStorage as backup
      if (currentTrip) {
        const storageKey = `expense_splits_${currentTrip.id}`;
        localStorage.setItem(storageKey, JSON.stringify(allSplits));
      }
      
      return allSplits;
    });
    
    // Update backend with new participant list
    try {
      await expensesApi.update(expenseId, { participant_ids: newSplits });
      console.log('✅ Updated expense splits on backend:', newSplits);
    } catch (error) {
      console.warn('Failed to update expense splits on backend:', error);
    }
  };

  // Initialize splits with payer when editing starts
  const startEditingSplit = (expenseId: number, payerId?: number) => {
    if (editingSplitId === expenseId) {
      setEditingSplitId(null);
    } else {
      // Initialize with payer if not already set
      if (payerId && (!expenseSplits[expenseId] || expenseSplits[expenseId].length === 0)) {
        setExpenseSplits(prev => ({
          ...prev,
          [expenseId]: [payerId]
        }));
      }
      setEditingSplitId(expenseId);
    }
  };

  // Start editing expense details (place/time)
  const startEditingExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setEditingPlace(expense.place || expense.description || '');
    // Parse time if exists (format: "HH:MM")
    if (expense.time) {
      const [hour, minute] = expense.time.split(':');
      setEditingHour(hour || '12');
      setEditingMinute(minute || '00');
    } else {
      setEditingHour('12');
      setEditingMinute('00');
    }
    setEditingTime(expense.time || '');
    // Close split editing if open
    setEditingSplitId(null);
  };

  // Save edited expense
  const saveEditedExpense = async (expenseId: number) => {
    const newTime = `${editingHour}:${editingMinute}`;
    
    console.log('💾 Saving expense edit:', { expenseId, place: editingPlace, time: newTime });
    
    try {
      const updated = await expensesApi.update(expenseId, {
        description: editingPlace,
        time: newTime,
      });
      
      console.log('✅ Expense updated:', updated);
      
      // Update local state
      setExpenses(prev => prev.map(e => 
        e.id === expenseId 
          ? { ...e, place: editingPlace, description: editingPlace, time: newTime }
          : e
      ));
      
      setEditingExpenseId(null);
    } catch (error) {
      console.error('❌ Failed to update expense:', error);
      alert('Failed to update expense. Please try again.');
    }
  };

  // Cancel editing
  const cancelEditingExpense = () => {
    setEditingExpenseId(null);
    setEditingPlace('');
    setEditingTime('');
  };

  // Load expense splits from localStorage
  useEffect(() => {
    if (currentTrip) {
      const storageKey = `expense_splits_${currentTrip.id}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setExpenseSplits(JSON.parse(stored));
      }
    }
  }, [currentTrip]);

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
          <button className="action-btn manual" onClick={openAddModal}>
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

      {/* Daily Expense Summary - My total spending */}
      {expenses.length > 0 && (() => {
        // Get my user ID
        const myUserId = user?.id;
        const myUsername = user?.username;
        
        // 1. Calculate total I PAID (where I'm the payer)
        const myPaidExpenses = expenses.filter(e => 
          e.payer_id === myUserId || e.payer_username === myUsername
        );
        const totalIPaidKRW = myPaidExpenses.reduce((sum, e) => 
          sum + (e.amount_krw || convertToKRW(e.amount, e.currency)), 0
        );
        
        // 2. Calculate MY SHARE (my portion of all expenses where I'm included in split)
        let myTotalShareKRW = 0;
        expenses.forEach(e => {
          const splits = expenseSplits[e.id] || [];
          
          // Check if I'm included in the split
          const amIInSplit = splits.includes(myUserId || 0) || 
            (splits.length === 0 && (e.payer_id === myUserId || e.payer_username === myUsername));
          
          if (amIInSplit && splits.length > 0) {
            const expenseKRW = e.amount_krw || convertToKRW(e.amount, e.currency);
            const numPeople = splits.length;
            const baseShare = Math.floor(expenseKRW / numPeople);
            const remainder = expenseKRW - (baseShare * numPeople);
            
            // If I'm the payer, I pay base + remainder, otherwise just base
            const amIPayer = e.payer_id === myUserId || e.payer_username === myUsername;
            myTotalShareKRW += amIPayer ? (baseShare + remainder) : baseShare;
          } else if (splits.length === 0) {
            // No split set - assume full amount for payer
            if (e.payer_id === myUserId || e.payer_username === myUsername) {
              myTotalShareKRW += e.amount_krw || convertToKRW(e.amount, e.currency);
            }
          }
        });
        
        // 3. Calculate SETTLEMENT (I Paid - My Share)
        // Positive = I should receive, Negative = I should pay
        const settlementKRW = totalIPaidKRW - myTotalShareKRW;

        return (
          <div className="expense-summary-bar">
            {/* I Paid */}
            <div className="summary-row">
              <div className="summary-item">
                <span className="summary-label">💸 I Paid</span>
                <span className="summary-amount paid">₩{totalIPaidKRW.toLocaleString()}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">📊 My Share</span>
                <span className="summary-amount share">₩{myTotalShareKRW.toLocaleString()}</span>
              </div>
            </div>
            {/* Settlement */}
            <div className="summary-settlement">
              {settlementKRW >= 0 ? (
                <>
                  <span className="settlement-label">💰 To Receive</span>
                  <span className="settlement-amount positive">+₩{settlementKRW.toLocaleString()}</span>
                </>
              ) : (
                <>
                  <span className="settlement-label">💳 To Pay</span>
                  <span className="settlement-amount negative">-₩{Math.abs(settlementKRW).toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        );
      })()}

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
            {expenses.map((expense) => {
              const splits = expenseSplits[expense.id] || [];
              const isSplitEditing = editingSplitId === expense.id;
              const isDetailEditing = editingExpenseId === expense.id;
              
              // Determine payer name - show actual payer username from API
              const payerName = expense.payer_username || 
                (expense.payer_id === user?.id ? user?.username : null) ||
                'Unknown';
              const isMyExpense = expense.payer_id === user?.id || expense.payer_username === user?.username;
              
              return (
                <div key={expense.id} className="expense-card-wrapper">
                  <div className={`expense-card ${!isMyExpense ? 'shared-expense' : ''} ${isDetailEditing ? 'editing' : ''}`}>
                    {/* Time - clickable to edit */}
                    {isDetailEditing ? (
                      <div className="expense-time editing">
                        <select 
                          value={editingHour} 
                          onChange={(e) => setEditingHour(e.target.value)}
                          className="time-select"
                        >
                          {hourOptions.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        :
                        <select 
                          value={editingMinute} 
                          onChange={(e) => setEditingMinute(e.target.value)}
                          className="time-select"
                        >
                          {minuteOptions.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div 
                        className="expense-time clickable" 
                        onClick={() => isMyExpense && startEditingExpense(expense)}
                        title={isMyExpense ? "Click to edit" : ""}
                      >
                        {expense.time || '--:--'}
                      </div>
                    )}
                    
                    <div className="expense-category">{getCategoryEmoji(expense.category)}</div>
                    
                    <div className="expense-details">
                      <div className="amount-row">
                        <span className="original">{expense.amount.toLocaleString()} {expense.currency}</span>
                        <span className="arrow">→</span>
                        <span className="converted">{(expense.amount_krw || convertToKRW(expense.amount, expense.currency)).toLocaleString()} KRW</span>
                      </div>
                      
                      {/* Place - editable */}
                      {isDetailEditing ? (
                        <input
                          type="text"
                          className="place-input"
                          value={editingPlace}
                          onChange={(e) => setEditingPlace(e.target.value)}
                          placeholder="Enter place name"
                          autoFocus
                        />
                      ) : (
                        <div 
                          className={`place ${isMyExpense ? 'clickable' : ''}`}
                          onClick={() => isMyExpense && startEditingExpense(expense)}
                          title={isMyExpense ? "Click to edit" : ""}
                        >
                          {expense.place || expense.description || 'No place'}
                        </div>
                      )}
                      
                      {!isMyExpense && (
                        <div className="shared-by">
                          <span className="shared-badge">👥 Shared</span>
                          <span className="shared-author">by {payerName}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Edit actions or Payer info */}
                    {isDetailEditing ? (
                      <div className="edit-actions">
                        <button className="save-edit-btn" onClick={() => saveEditedExpense(expense.id)}>✓</button>
                        <button className="cancel-edit-btn" onClick={cancelEditingExpense}>✕</button>
                      </div>
                    ) : (
                      <div 
                        className={`payer-info ${isSplitEditing ? 'active' : ''}`}
                        onClick={() => startEditingSplit(expense.id, expense.payer_id)}
                      >
                        <span className="payer-name">{isMyExpense ? `${user?.username} (Me)` : payerName}</span>
                        <span className="split-count">
                          ÷{splits.length > 0 ? splits.length : 1}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Split Selection Dropdown */}
                  {isSplitEditing && (
                    <div className="split-dropdown">
                      <div className="split-dropdown-header">
                        <span>Split with (÷{splits.length || 1}):</span>
                        <button 
                          className="close-split"
                          onClick={() => setEditingSplitId(null)}
                        >✕</button>
                      </div>
                      <div className="split-options">
                        {/* All participants (including current user) */}
                        {participants.map(p => {
                          const isCurrentUser = p.id === user?.id || (p as any).username === user?.username;
                          const isPayer = p.id === expense.payer_id;
                          const displayName = isCurrentUser ? `${(p as any).username || p.name} (Me)` : (p.name || (p as any).username || `User ${p.id}`);
                          return (
                            <label key={p.id} className={`split-option ${isCurrentUser ? 'current-user' : ''} ${isPayer ? 'payer-locked' : ''}`}>
                              <input 
                                type="checkbox"
                                checked={splits.includes(p.id)}
                                onChange={() => toggleExpenseSplit(expense.id, p.id, expense.payer_id)}
                                disabled={isPayer}
                              />
                              <span className="option-check">{isPayer ? '🔒' : (splits.includes(p.id) ? '✓' : '')}</span>
                              <span className="option-name">{displayName}{isPayer ? ' (Payer)' : ''}</span>
                            </label>
                          );
                        })}
                      </div>
                      {splits.length > 0 && (
                        <div className="split-summary-inline">
                          {formatSplitSummary(expense.amount, splits.length, expense.currency)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
                  {participants.map(p => {
                    const isCurrentUser = p.id === user?.id || (p as any).username === user?.username;
                    const displayName = isCurrentUser ? `${(p as any).username || p.name} (Me)` : (p.name || (p as any).username || `User ${p.id}`);
                    return (
                      <button 
                        key={p.id}
                        className={`payer-chip ${newExpense.paid_by === p.id ? 'active' : ''} ${isCurrentUser ? 'current-user' : ''}`}
                        onClick={() => handlePayerChange(p.id)}
                      >
                        {displayName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Split with */}
              <div className="form-section">
                <label>Split with (÷{newExpense.split_with.length || 1})</label>
                <div className="split-row">
                  {/* All participants (including current user) */}
                  {participants.map(p => {
                    const isCurrentUser = p.id === user?.id || (p as any).username === user?.username;
                    const isPayer = p.id === newExpense.paid_by;
                    const displayName = isCurrentUser ? `${(p as any).username || p.name} (Me)` : (p.name || (p as any).username || `User ${p.id}`);
                    return (
                      <label key={p.id} className={`split-checkbox ${isCurrentUser ? 'current-user' : ''} ${isPayer ? 'payer-locked' : ''}`}>
                        <input 
                          type="checkbox"
                          checked={newExpense.split_with.includes(p.id)}
                          onChange={() => toggleSplitWith(p.id)}
                          disabled={isPayer} // Payer cannot be unchecked
                        />
                        <span className="checkmark">{isPayer ? '🔒' : ''}</span>
                        <span className="name">{displayName}{isPayer ? ' (Payer)' : ''}</span>
                      </label>
                    );
                  })}
                </div>
                {newExpense.split_with.length > 0 && newExpense.amount && (
                  <div className="split-summary">
                    {formatSplitSummary(parseFloat(newExpense.amount), newExpense.split_with.length, newExpense.currency)}
                  </div>
                )}
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
