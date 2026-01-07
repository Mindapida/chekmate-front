import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { diaryApi, expensesApi, tripsApi } from '../api';
import PhotoImage from '../components/PhotoImage';
import BottomNav, { saveLastPage } from '../components/BottomNav';
import './CalendarPage.css';
import '../components/PhotoImage.css';

// Mood emoji icons: happy, cool, party, heart, rain, sunny, sad (기쁨, 선글라스, 축하, 하트, 비, 맑음, 슬픔)
const MOOD_EMOJIS = ['😊', '😎', '🥳', '❤️', '🌧️', '☀️', '😢'];

// Local storage key for emoji data
const EMOJI_STORAGE_KEY = 'calendar_emojis';

interface EmojiData {
  [tripId: number]: {
    [dateKey: string]: string;
  };
}

// Photo preview data for each date
interface PhotoData {
  photoId: number;
  filePath: string;
  fileName: string;
  author: string;
  isExpense: boolean;
}

interface ExpenseData {
  id: number;
  description: string;
  amount: number;
  currency: string;
  payer_username: string;
}

interface DatePhotoData {
  photos: PhotoData[];
  hasExpense: boolean;
  expenseCount: number;
  totalAmount: number;
  expenses: ExpenseData[];
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const { currentTrip } = useTrips();
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [emojiData, setEmojiData] = useState<EmojiData>({});
  const [datePhotos, setDatePhotos] = useState<{ [date: string]: DatePhotoData }>({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [participants, setParticipants] = useState<{ id: number; username: string }[]>([]);

  // Save current page on mount
  useEffect(() => {
    saveLastPage('/calendar');
  }, []);

  // Load emoji data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(EMOJI_STORAGE_KEY);
    if (stored) {
      setEmojiData(JSON.parse(stored));
    }
  }, []);

  // Auto-navigate to trip's start month when currentTrip changes
  useEffect(() => {
    if (currentTrip) {
      const tripStart = new Date(currentTrip.start_date);
      setCurrentDate(new Date(tripStart.getFullYear(), tripStart.getMonth(), 1));
    }
  }, [currentTrip]);

  // Load photos and expenses for all dates in the trip (shared among all participants!)
  const loadTripData = useCallback(async () => {
    if (!currentTrip) return;
    
    setLoadingPhotos(true);
    const photoData: { [date: string]: DatePhotoData } = {};
    
    console.log('📅 Loading trip data for trip:', currentTrip.id, currentTrip.name);
    console.log('👤 Current user:', user?.username, user?.id);
    
    try {
      const startDate = new Date(currentTrip.start_date);
      const endDate = new Date(currentTrip.end_date);
      
      // Load data for each date in the trip
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        try {
          // Get diary entries (photos from ALL participants!)
          const entries = await diaryApi.getEntriesForDate(currentTrip.id, dateStr);
          
          // Debug: Log all entries to see who's data we're getting
          if (entries.length > 0) {
            console.log(`📸 [${dateStr}] Diary entries:`, entries.map(e => ({
              id: e.id,
              user_id: e.user_id,
              username: e.username,
              photoCount: e.photos.length
            })));
          }
          
          const photos: PhotoData[] = [];
          
          entries.forEach(entry => {
            entry.photos.forEach(photo => {
              photos.push({
                photoId: photo.id,
                filePath: photo.file_path,
                fileName: photo.file_name,
                author: entry.username,
                isExpense: !!entry.expense_id,
              });
            });
          });
          
          // Get expenses with amounts
          let expenseCount = 0;
          let totalAmount = 0;
          const expenseList: ExpenseData[] = [];
          try {
            const expenses = await expensesApi.getByDate(currentTrip.id, dateStr);
            expenseCount = expenses.length;
            
            expenses.forEach(e => {
              totalAmount += e.amount;
              expenseList.push({
                id: e.id,
                description: e.description,
                amount: e.amount,
                currency: e.currency || 'KRW',
                payer_username: e.payer_username,
              });
            });
            
            // Debug: Log expenses to see sharing
            if (expenses.length > 0) {
              console.log(`💰 [${dateStr}] Expenses:`, expenses.map(e => ({
                id: e.id,
                payer_username: e.payer_username,
                amount: e.amount
              })), `Total: ${totalAmount}`);
            }
          } catch {
            // No expenses for this date
          }
          
          if (photos.length > 0 || expenseCount > 0) {
            photoData[dateStr] = {
              photos,
              hasExpense: expenseCount > 0,
              expenseCount,
              totalAmount,
              expenses: expenseList,
            };
          }
        } catch (error) {
          console.error(`Failed to load data for ${dateStr}:`, error);
        }
      }
      
      setDatePhotos(photoData);
      
      // Summary log
      const allPhotos = Object.values(photoData).flatMap(d => d.photos);
      const uniqueAuthors = [...new Set(allPhotos.map(p => p.author))];
      console.log('📅 Calendar data loaded:', {
        datesWithData: Object.keys(photoData).length,
        totalPhotos: allPhotos.length,
        photoAuthors: uniqueAuthors,
        myPhotos: allPhotos.filter(p => p.author === user?.username).length,
        sharedPhotos: allPhotos.filter(p => p.author !== user?.username).length,
      });
    } catch (error) {
      console.error('Failed to load trip data:', error);
    } finally {
      setLoadingPhotos(false);
    }
  }, [currentTrip, user]);

  // Load participants for the trip
  const loadParticipants = useCallback(async () => {
    if (!currentTrip) return;
    
    try {
      const parts = await tripsApi.getParticipants(currentTrip.id);
      console.log('👥 Trip participants:', parts);
      setParticipants(parts.map(p => ({ id: p.id, username: p.username || p.name })));
    } catch (error) {
      console.error('Failed to load participants:', error);
    }
  }, [currentTrip]);

  // Load photos and participants when trip changes
  useEffect(() => {
    loadTripData();
    loadParticipants();
  }, [loadTripData, loadParticipants]);

  // Save emoji data to localStorage
  const saveEmojiData = (data: EmojiData) => {
    localStorage.setItem(EMOJI_STORAGE_KEY, JSON.stringify(data));
    setEmojiData(data);
  };

  if (!currentTrip) {
    return (
      <div className="calendar-page">
        <div className="no-trip-message">
          <span>📅</span>
          <h2>No trip selected</h2>
          <p>Please select a current trip first</p>
          <button onClick={() => navigate('/home')}>Go to Home</button>
        </div>
        <BottomNav activeTab="calendar" />
      </div>
    );
  }

  const tripStart = new Date(currentTrip.start_date);
  const tripEnd = new Date(currentTrip.end_date);
  tripStart.setHours(0, 0, 0, 0);
  tripEnd.setHours(23, 59, 59, 999);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isInTripRange = (day: number) => {
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    checkDate.setHours(12, 0, 0, 0);
    return checkDate >= tripStart && checkDate <= tripEnd;
  };

  const isStartDate = (day: number) => {
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return checkDate.toDateString() === tripStart.toDateString();
  };

  const isEndDate = (day: number) => {
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return checkDate.toDateString() === tripEnd.toDateString();
  };

  const isSelectedDate = (day: number) => {
    if (!selectedDate) return false;
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return checkDate.toDateString() === selectedDate.toDateString();
  };

  // Format date as YYYY-MM-DD in local timezone (not UTC)
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateKey = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return formatLocalDate(date);
  };

  const getEmojiForDay = (day: number) => {
    if (!currentTrip) return null;
    const dateKey = getDateKey(day);
    return emojiData[currentTrip.id]?.[dateKey] || null;
  };

  // Get photo data for a specific day (in current month view)
  const getPhotoDataForDay = (day: number): DatePhotoData | null => {
    const dateKey = getDateKey(day);
    return datePhotos[dateKey] || null;
  };

  // Get photo data for selectedDate directly (not from current month view)
  const getSelectedDatePhotoData = (): DatePhotoData | null => {
    if (!selectedDate) return null;
    const dateKey = formatLocalDate(selectedDate);
    return datePhotos[dateKey] || null;
  };

  const handleEmojiSelect = (emoji: string) => {
    if (!selectedDate || !currentTrip) return;
    
    const dateKey = formatLocalDate(selectedDate);
    const newData = { ...emojiData };
    
    if (!newData[currentTrip.id]) {
      newData[currentTrip.id] = {};
    }
    
    // Toggle: if same emoji, remove it
    if (newData[currentTrip.id][dateKey] === emoji) {
      delete newData[currentTrip.id][dateKey];
    } else {
      newData[currentTrip.id][dateKey] = emoji;
    }
    
    saveEmojiData(newData);
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(clickedDate);
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const day = selectedDate.getDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'KRW') => {
    if (currency === 'KRW') {
      return `₩${amount.toLocaleString()}`;
    } else if (currency === 'USD') {
      return `$${amount.toLocaleString()}`;
    } else if (currency === 'EUR') {
      return `€${amount.toLocaleString()}`;
    } else if (currency === 'JPY') {
      return `¥${amount.toLocaleString()}`;
    }
    return `${amount.toLocaleString()} ${currency}`;
  };

  const formatTripDates = () => {
    const start = `${tripStart.getMonth() + 1}/${tripStart.getDate()}`;
    const end = `${tripEnd.getMonth() + 1}/${tripEnd.getDate()}`;
    return `${start} - ${end}`;
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  return (
    <div className="calendar-page">
      <div className="page-content">
        {/* Compact Header */}
        <header className="compact-header">
          <div className="header-logo">
            <span className="logo-check">✓</span>
            <span className="logo-text">CHECKMATE</span>
          </div>
          <div className="trip-badge">
            <span>✈️</span>
            <span>{currentTrip.name}</span>
            <span className="trip-period">{formatTripDates()}</span>
          </div>
        </header>
        
        {/* Participants Info Bar - Shows who's sharing this trip */}
        {participants.length > 0 && (
          <div className="participants-bar">
            <span className="participants-label">👥 Participants:</span>
            <div className="participants-list">
              {participants.map((p) => (
                <span 
                  key={p.id} 
                  className={`participant-chip ${p.username === user?.username ? 'me' : ''}`}
                >
                  {p.username === user?.username ? 'Me' : p.username}
                </span>
              ))}
            </div>
            {participants.length > 1 && (
              <span className="sharing-indicator">📸 사진 공유 중</span>
            )}
          </div>
        )}

        {/* Calendar */}
        <div className="calendar-wrapper">
          {/* Month Navigation */}
          <div className="month-nav">
            <button className="month-btn" onClick={prevMonth}>◀</button>
            <div className="month-title">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </div>
            <button className="month-btn" onClick={nextMonth}>▶</button>
          </div>

          {/* Day Names */}
          <div className="day-names">
            {dayNames.map((day, idx) => (
              <div key={idx} className={`day-name ${idx === 0 ? 'sun' : idx === 6 ? 'sat' : ''}`}>
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="days-grid">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="day-cell empty"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const inTrip = isInTripRange(day);
              const isStart = isStartDate(day);
              const isEnd = isEndDate(day);
              const isSelected = isSelectedDate(day);
              const dayOfWeek = (firstDay + i) % 7;
              const isSunday = dayOfWeek === 0;
              const isSaturday = dayOfWeek === 6;
              const emoji = getEmojiForDay(day);
              const photoData = getPhotoDataForDay(day);
              const hasPhotos = photoData && photoData.photos.length > 0;
              const hasExpenses = photoData && photoData.hasExpense;

              return (
                <div 
                  key={day} 
                  className={`day-cell 
                    ${inTrip ? 'in-trip' : ''} 
                    ${isStart ? 'trip-start' : ''} 
                    ${isEnd ? 'trip-end' : ''} 
                    ${isSelected ? 'selected' : ''}
                    ${isSunday ? 'sunday' : ''}
                    ${isSaturday ? 'saturday' : ''}
                    ${hasPhotos ? 'has-photos' : ''}
                  `}
                  onClick={() => handleDayClick(day)}
                >
                  <span className="day-number">{day}</span>
                  {emoji && <span className="day-emoji">{emoji}</span>}
                  
                  {/* Photo thumbnail preview (shared from all participants!) */}
                  {hasPhotos && (
                    <div className="day-photo-preview">
                      <PhotoImage
                        photoId={photoData.photos[0].photoId}
                        filePath={photoData.photos[0].filePath}
                        fileName={photoData.photos[0].fileName}
                        className="calendar-day-photo"
                      />
                      {photoData.photos.length > 1 && (
                        <span className="photo-count">+{photoData.photos.length - 1}</span>
                      )}
                      {/* Show if there are photos from other users */}
                      {photoData.photos.some(p => p.author !== user?.username) && (
                        <span className="shared-indicator">👥</span>
                      )}
                    </div>
                  )}
                  
                  {/* Expense indicator */}
                  {hasExpenses && !hasPhotos && (
                    <span className="expense-indicator">💰</span>
                  )}
                  {hasExpenses && hasPhotos && (
                    <span className="expense-badge">{photoData.expenseCount}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Emoji & Actions Section */}
        <div className="actions-section">
          {/* Selected Date Info with Expense Summary */}
          {selectedDate && (() => {
            const photoData = getSelectedDatePhotoData();
            const hasExpenses = photoData && photoData.expenses.length > 0;
            
            return (
              <div className="selected-date-info">
                <div className="selected-date-header">
                  <span className="selected-date-text">📅 {formatSelectedDate()}</span>
                  {loadingPhotos && <span className="loading-indicator">⏳</span>}
                </div>
                
                {/* Expense Summary for Selected Date */}
                {hasExpenses && (
                  <div className="expense-summary">
                    <div className="expense-summary-header">
                      <span className="expense-icon">💰</span>
                      <span className="expense-total">
                        총 지출: <strong>{formatCurrency(photoData.totalAmount)}</strong>
                      </span>
                      <span className="expense-count">({photoData.expenses.length}건)</span>
                    </div>
                    <div className="expense-list">
                      {photoData.expenses.slice(0, 3).map((expense) => (
                        <div key={expense.id} className="expense-item">
                          <span className="expense-desc">{expense.description}</span>
                          <span className="expense-amount">{formatCurrency(expense.amount, expense.currency)}</span>
                          <span className="expense-payer">by {expense.payer_username === user?.username ? 'Me' : expense.payer_username}</span>
                        </div>
                      ))}
                      {photoData.expenses.length > 3 && (
                        <div 
                          className="more-expenses"
                          onClick={() => navigate(`/expense?date=${formatLocalDate(selectedDate)}`)}
                        >
                          +{photoData.expenses.length - 3}건 더 보기
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          
          {/* Photo Preview Section for Selected Date */}
          {selectedDate && isInTripRange(selectedDate.getDate()) && (() => {
            const photoData = getSelectedDatePhotoData();
            if (!photoData || photoData.photos.length === 0) return null;
            
            const sharedPhotos = photoData.photos.filter(p => p.author !== user?.username);
            
            return (
              <div className="date-photos-preview">
                <div className="photos-header">
                  <span>📸 Photos ({photoData.photos.length})</span>
                  {sharedPhotos.length > 0 && (
                    <span className="shared-photos-badge">
                      👥 {sharedPhotos.length} shared
                    </span>
                  )}
                </div>
                <div className="photos-scroll">
                  {photoData.photos.slice(0, 6).map((photo, idx) => (
                    <div 
                      key={idx} 
                      className={`preview-photo ${photo.author !== user?.username ? 'shared' : ''}`}
                    >
                      <PhotoImage
                        photoId={photo.photoId}
                        filePath={photo.filePath}
                        fileName={photo.fileName}
                        className="preview-photo-img"
                      />
                      <span className="photo-author">{photo.author === user?.username ? 'Me' : photo.author}</span>
                      {photo.isExpense && <span className="expense-tag">💰</span>}
                    </div>
                  ))}
                  {photoData.photos.length > 6 && (
                    <div 
                      className="more-photos"
                      onClick={() => navigate('/images')}
                    >
                      +{photoData.photos.length - 6} more
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Emoji Selector */}
          <div className="emoji-row">
            {MOOD_EMOJIS.map((emoji, idx) => (
              <button 
                key={idx} 
                className={`emoji-btn ${!selectedDate ? 'disabled' : ''} ${selectedDate && getEmojiForDay(selectedDate.getDate()) === emoji ? 'active' : ''}`}
                onClick={() => handleEmojiSelect(emoji)}
                disabled={!selectedDate}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          {selectedDate && isInTripRange(selectedDate.getDate()) && (
            <div className="action-row">
              <button 
                className="action-btn expense"
                onClick={() => navigate(`/expense?date=${formatLocalDate(selectedDate)}`)}
              >
                💰 EXPENSE
              </button>
              <button 
                className="action-btn photo"
                onClick={() => navigate(`/photo-memo?date=${formatLocalDate(selectedDate)}`)}
              >
                📷 PHOTO
              </button>
            </div>
          )}
        </div>
      </div>
      <BottomNav activeTab="calendar" />
    </div>
  );
}
