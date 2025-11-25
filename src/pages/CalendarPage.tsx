import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import BottomNav from '../components/BottomNav';
import './CalendarPage.css';

// Mood emoji icons: sad, heart, rain, sunny
const MOOD_EMOJIS = ['😢', '❤️', '🌧️', '☀️'];

// Local storage key for emoji data
const EMOJI_STORAGE_KEY = 'calendar_emojis';

interface EmojiData {
  [tripId: number]: {
    [dateKey: string]: string;
  };
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const { currentTrip } = useTrips();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [emojiData, setEmojiData] = useState<EmojiData>({});

  // Load emoji data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(EMOJI_STORAGE_KEY);
    if (stored) {
      setEmojiData(JSON.parse(stored));
    }
  }, []);

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

  const getDateKey = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return date.toISOString().split('T')[0];
  };

  const getEmojiForDay = (day: number) => {
    if (!currentTrip) return null;
    const dateKey = getDateKey(day);
    return emojiData[currentTrip.id]?.[dateKey] || null;
  };

  const handleEmojiSelect = (emoji: string) => {
    if (!selectedDate || !currentTrip) return;
    
    const dateKey = selectedDate.toISOString().split('T')[0];
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

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

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
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    };
    return selectedDate.toLocaleDateString('en-US', options);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  return (
    <div className="calendar-page">
      <div className="page-content">
        {/* Header */}
        <header className="page-header">
          <div className="header-logo">
            <span className="logo-check">✓</span>
            <span className="logo-text">CHECKMATE</span>
          </div>
        </header>

        {/* Trip Info Bar */}
        <div className="trip-info-bar">
          <span className="trip-icon">✈️</span>
          <span className="trip-name">{currentTrip.name}</span>
          <span className="trip-dates">{currentTrip.start_date} ~ {currentTrip.end_date}</span>
        </div>

        {/* Calendar */}
        <div className="calendar-wrapper">
          {/* Month Navigation */}
          <div className="month-nav">
            <button className="month-btn" onClick={prevMonth}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="month-title">
              <span>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
            </div>
            <button className="month-btn" onClick={nextMonth}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Day Names */}
          <div className="day-names">
            {dayNames.map(day => (
              <div key={day} className={`day-name ${day === 'SUN' ? 'sun' : day === 'SAT' ? 'sat' : ''}`}>
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
                  `}
                  onClick={() => handleDayClick(day)}
                >
                  <span className="day-number">{day}</span>
                  {emoji && <span className="day-emoji">{emoji}</span>}
                  {(isStart || isEnd) && !emoji && (
                    <span className="trip-marker">{isStart ? '🛫' : '🛬'}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="calendar-legend">
            <div className="legend-item">
              <span className="legend-dot trip"></span>
              <span>Trip Period</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot selected"></span>
              <span>Selected</span>
            </div>
          </div>
        </div>

        {/* Emoji Selector - Always visible */}
        <div className="emoji-section">
          <div className="emoji-header">
            {selectedDate ? (
              <>
                <span className="emoji-date-icon">📅</span>
                <span className="emoji-date">{formatSelectedDate()}</span>
              </>
            ) : (
              <span className="emoji-hint">👆 Select a date to add mood</span>
            )}
          </div>
          
          <div className="emoji-selector">
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
            <div className="action-buttons">
              <button 
                className="action-btn expense-btn"
                onClick={() => navigate(`/expense?date=${selectedDate.toISOString().split('T')[0]}`)}
              >
                <span className="action-icon">💰</span>
                <span className="action-text">EXPENSE</span>
              </button>
              <button className="action-btn photo-btn">
                <span className="action-icon">📷</span>
                <span className="action-text">PHOTO</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <BottomNav activeTab="calendar" />
    </div>
  );
}
