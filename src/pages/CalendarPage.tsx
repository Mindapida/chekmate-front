import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import BottomNav from '../components/BottomNav';
import './CalendarPage.css';

export default function CalendarPage() {
  const navigate = useNavigate();
  const { currentTrip } = useTrips();
  const [currentDate, setCurrentDate] = useState(new Date());

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
    return checkDate >= tripStart && checkDate <= tripEnd;
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

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  return (
    <div className="calendar-page">
      <div className="page-content">
        <header className="page-header">
          <div className="header-logo">
            <span className="logo-check">✓</span>
            <span className="logo-text">CHECKMATE</span>
          </div>
        </header>

        <div className="calendar-container">
          <div className="calendar-nav">
            <button className="nav-btn" onClick={prevMonth}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="month-year">
              <h2>{monthNames[currentDate.getMonth()].toUpperCase()}</h2>
              <span>✈️</span>
            </div>
            <button className="nav-btn" onClick={nextMonth}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className="calendar-grid">
            <div className="day-names">
              {dayNames.map(day => (
                <div key={day} className="day-name">{day}</div>
              ))}
            </div>

            <div className="days">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="day empty"></div>
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const inTrip = isInTripRange(day);
                return (
                  <div 
                    key={day} 
                    className={`day ${inTrip ? 'in-trip' : ''}`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="trip-summary">
          <div className="summary-item">
            <span className="icon">📍</span>
            <span className="label">{currentTrip.name}</span>
          </div>
          <div className="summary-item">
            <span className="icon">📅</span>
            <span className="label">{currentTrip.start_date} - {currentTrip.end_date}</span>
          </div>
        </div>

        <div className="action-buttons">
          <button className="action-btn expense">
            <span>💰</span>
            <span>EXPENSE</span>
          </button>
          <button className="action-btn photo">
            <span>📷</span>
            <span>PHOTO</span>
          </button>
        </div>
      </div>
      <BottomNav activeTab="calendar" />
    </div>
  );
}

