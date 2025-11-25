import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import BottomNav from '../components/BottomNav';
import './CalendarPage.css';

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

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isInTripRange = (day: number) => {
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    checkDate.setHours(0, 0, 0, 0);
    const start = new Date(tripStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(tripEnd);
    end.setHours(0, 0, 0, 0);
    return checkDate >= start && checkDate <= end;
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
    if (isInTripRange(day)) {
      setSelectedDate(clickedDate);
    }
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

        {/* Trip Info Bar - Compact */}
        <div className="trip-info-compact">
          <span className="trip-icon-small">✈️</span>
          <span className="trip-name-small">{currentTrip.name}</span>
          <span className="trip-dates-small">{currentTrip.start_date} ~ {currentTrip.end_date}</span>
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
                  {(isStart || isEnd) && <span className="trip-marker">{isStart ? '🛫' : '🛬'}</span>}
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

        {/* Selected Date Actions */}
        {selectedDate && (
          <div className="selected-date-panel">
            <div className="selected-date-header">
              <span className="selected-date-icon">📅</span>
              <span className="selected-date-text">{formatSelectedDate()}</span>
            </div>
            <div className="action-buttons">
              <button className="action-btn expense-btn">
                <span className="action-icon">💰</span>
                <span className="action-text">EXPENSE</span>
              </button>
              <button className="action-btn photo-btn">
                <span className="action-icon">📷</span>
                <span className="action-text">PHOTO</span>
              </button>
            </div>
          </div>
        )}

        {/* Hint when no date selected */}
        {!selectedDate && (
          <div className="select-hint">
            <span>👆</span>
            <p>Select a date within your trip to add expenses or photos</p>
          </div>
        )}
      </div>
      <BottomNav activeTab="calendar" />
    </div>
  );
}
