import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import BottomNav from '../components/BottomNav';
import './CalendarPage.css';

// Mood emoji icons: sad, heart, rain, sunny + happy, cool, party
const MOOD_EMOJIS = ['😢', '❤️', '🌧️', '☀️', '😊', '😎', '🥳'];

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

  // Auto-navigate to trip's start month when currentTrip changes
  useEffect(() => {
    if (currentTrip) {
      const tripStart = new Date(currentTrip.start_date);
      setCurrentDate(new Date(tripStart.getFullYear(), tripStart.getMonth(), 1));
    }
  }, [currentTrip]);

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
    return `${selectedDate.getMonth() + 1}/${selectedDate.getDate()}`;
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
                </div>
              );
            })}
          </div>
        </div>

        {/* Emoji & Actions Section */}
        <div className="actions-section">
          {/* Selected Date */}
          {selectedDate && (
            <div className="selected-info">
              📅 {formatSelectedDate()}
            </div>
          )}

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
                onClick={() => navigate(`/expense?date=${selectedDate.toISOString().split('T')[0]}`)}
              >
                💰 EXPENSE
              </button>
              <button className="action-btn photo">
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
