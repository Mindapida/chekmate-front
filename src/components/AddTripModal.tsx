import { useState, useEffect } from 'react';
import './AddTripModal.css';

interface AddTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTrip: (tripData: { name: string; startDate: string; endDate: string }) => void;
}

export default function AddTripModal({ isOpen, onClose, onCreateTrip }: AddTripModalProps) {
  const [tripName, setTripName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCalendar, setShowCalendar] = useState<'start' | 'end' | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
      setTripName('');
      setStartDate('');
      setEndDate('');
      setShowCalendar(null);
    }, 300);
  };

  const handleSubmit = () => {
    if (tripName && startDate && endDate) {
      onCreateTrip({ name: tripName, startDate, endDate });
      handleClose();
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Select';
    return dateStr;
  };

  const formatDateRange = (start: string, end: string) => {
    if (!start || !end) return '';
    return `${start} to ${end}`;
  };

  // Calendar logic
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days: (number | null)[] = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push(-(prevMonthLastDay - i));
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(null);
    }
    
    return days;
  };

  const handleDateSelect = (day: number | null) => {
    if (day === null || day < 1) return;
    
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    
    if (showCalendar === 'start') {
      setStartDate(dateStr);
      if (endDate && dateStr > endDate) {
        setEndDate('');
      }
      setShowCalendar('end');
    } else if (showCalendar === 'end') {
      if (startDate && dateStr < startDate) {
        return;
      }
      setEndDate(dateStr);
      setShowCalendar(null);
    }
  };

  const isDateSelected = (day: number | null) => {
    if (day === null || day < 1) return false;
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    return dateStr === startDate || dateStr === endDate;
  };

  const isDateInRange = (day: number | null) => {
    if (day === null || day < 1 || !startDate || !endDate) return false;
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    return dateStr > startDate && dateStr < endDate;
  };

  const isDateDisabled = (day: number | null) => {
    if (day === null || day < 1) return true;
    if (showCalendar !== 'end' || !startDate) return false;
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    return dateStr < startDate;
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`modal-container ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Add New Trip</h2>
          <button className="close-button" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Trip Name */}
          <div className="form-group animate-in" style={{ animationDelay: '0.1s' }}>
            <label className="form-label">Trip Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Tokyo Adventure"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
            />
          </div>

          {/* Date Selection */}
          <div className="form-group animate-in" style={{ animationDelay: '0.15s' }}>
            <label className="form-label">Select Dates</label>
            <div className="date-grid">
              <button 
                className={`date-picker ${showCalendar === 'start' ? 'active' : ''} ${startDate ? 'selected' : ''}`}
                onClick={() => setShowCalendar(showCalendar === 'start' ? null : 'start')}
              >
                <span className="date-label">Start Date</span>
                <div className="date-value">
                  <svg className="calendar-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M5.33333 1.33334V3.33334M10.6667 1.33334V3.33334M2.33333 6.06667H13.6667M3.33333 2.33334H12.6667C13.219 2.33334 13.6667 2.78106 13.6667 3.33334V12.6667C13.6667 13.219 13.219 13.6667 12.6667 13.6667H3.33333C2.78105 13.6667 2.33333 13.219 2.33333 12.6667V3.33334C2.33333 2.78106 2.78105 2.33334 3.33333 2.33334Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{formatDate(startDate)}</span>
                </div>
              </button>
              <button 
                className={`date-picker ${showCalendar === 'end' ? 'active' : ''} ${endDate ? 'selected' : ''}`}
                onClick={() => setShowCalendar(showCalendar === 'end' ? null : 'end')}
              >
                <span className="date-label">End Date</span>
                <div className="date-value">
                  <svg className="calendar-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M5.33333 1.33334V3.33334M10.6667 1.33334V3.33334M2.33333 6.06667H13.6667M3.33333 2.33334H12.6667C13.219 2.33334 13.6667 2.78106 13.6667 3.33334V12.6667C13.6667 13.219 13.219 13.6667 12.6667 13.6667H3.33333C2.78105 13.6667 2.33333 13.219 2.33333 12.6667V3.33334C2.33333 2.78106 2.78105 2.33334 3.33333 2.33334Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{formatDate(endDate)}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Calendar */}
          {showCalendar && (
            <div className="calendar-container animate-calendar">
              <div className="calendar-selecting">
                <span className={`selecting-indicator ${showCalendar}`}>
                  {showCalendar === 'start' ? '📍 Select Start Date' : '🏁 Select End Date'}
                </span>
              </div>
              <div className="calendar-header">
                <button className="calendar-nav" onClick={prevMonth}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8L10 4" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <span className="calendar-month">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                <button className="calendar-nav" onClick={nextMonth}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="calendar-days-header">
                {dayNames.map(day => (
                  <div key={day} className="calendar-day-name">{day}</div>
                ))}
              </div>
              <div className="calendar-days">
                {getDaysInMonth(currentMonth).map((day, index) => (
                  <button
                    key={index}
                    className={`calendar-day ${day === null || day < 1 ? 'empty' : ''} ${isDateSelected(day) ? 'selected' : ''} ${isDateInRange(day) ? 'in-range' : ''} ${isDateDisabled(day) ? 'disabled' : ''}`}
                    onClick={() => handleDateSelect(day)}
                    disabled={isDateDisabled(day)}
                  >
                    {day !== null && day > 0 ? day : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Range */}
          {startDate && endDate && (
            <div className="selected-range animate-in">
              <span className="range-label">Selected Range</span>
              <span className="range-value">{formatDateRange(startDate, endDate)}</span>
            </div>
          )}

          {/* Create Button */}
          <button 
            className={`create-button animate-in ${tripName && startDate && endDate ? 'ready' : ''}`}
            style={{ animationDelay: '0.2s' }}
            onClick={handleSubmit}
            disabled={!tripName || !startDate || !endDate}
          >
            <span className="button-text">Create Trip</span>
            {tripName && startDate && endDate && (
              <span className="button-icon">✈️</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
