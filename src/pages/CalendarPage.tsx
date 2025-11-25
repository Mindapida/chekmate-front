import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import BottomNav from '../components/BottomNav';
import './CalendarPage.css';

// Face emoji icons for trip participants
const FACE_EMOJIS = ['😊', '😎', '🥳', '😄', '🤗'];

export default function CalendarPage() {
  const navigate = useNavigate();
  const { currentTrip } = useTrips();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

  const isSelectedDate = (day: number) => {
    if (!selectedDate) return false;
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return checkDate.toDateString() === selectedDate.toDateString();
  };

  const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

  const dayNames = ['SUN', 'MON', 'TUE', 'WEN', 'THU', 'FRI', 'SAT'];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setSelectedDate(null);
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(clickedDate);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  // Create array of all days including empty slots
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push({ day: 0, isEmpty: true });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, isEmpty: false });
  }

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

        {/* Calendar Container */}
        <div className="calendar-container">
          {/* Month Navigation */}
          <div className="month-header">
            <button className="nav-btn" onClick={prevMonth}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="#171717" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="month-title">
              <span className="month-name">{monthNames[currentDate.getMonth()]}</span>
              <span className="month-icon">✈️</span>
            </div>
            <button className="nav-btn" onClick={nextMonth}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 18L15 12L9 6" stroke="#171717" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Day Names Header */}
          <div className="days-header">
            {dayNames.map(day => (
              <div key={day} className="day-header-cell">{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="days-divider"></div>
          <div className="days-grid">
            {calendarDays.map((item, index) => {
              const inTrip = !item.isEmpty && isInTripRange(item.day);
              const selected = !item.isEmpty && isSelectedDate(item.day);
              
              return (
                <div 
                  key={index}
                  className={`day-cell ${item.isEmpty ? 'empty' : ''} ${inTrip ? 'in-trip' : ''} ${selected ? 'selected' : ''}`}
                  onClick={() => !item.isEmpty && handleDayClick(item.day)}
                >
                  {!item.isEmpty && (
                    <div className="day-badge">{item.day}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Section - Face Emojis & Buttons */}
          <div className="calendar-actions">
            {/* Face Emoji Row */}
            <div className="face-emoji-row">
              {FACE_EMOJIS.map((emoji, idx) => (
                <button key={idx} className="face-emoji-btn">
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button className="action-btn expense-btn">
                <span className="btn-icon">💰</span>
                <span className="btn-text">EXPENSE</span>
              </button>
              <button className="action-btn photo-btn">
                <span className="btn-icon">📷</span>
                <span className="btn-text">PHOTO</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <BottomNav activeTab="calendar" />
    </div>
  );
}
