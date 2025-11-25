import { useState } from 'react';
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

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (tripName && startDate && endDate) {
      onCreateTrip({ name: tripName, startDate, endDate });
      setTripName('');
      setStartDate('');
      setEndDate('');
      onClose();
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Select';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Add New Trip</h2>
          <button className="close-button" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Trip Name */}
          <div className="form-group">
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
          <div className="form-group">
            <label className="form-label">Select Dates</label>
            <div className="date-grid">
              <div className="date-picker">
                <span className="date-label">Start Date</span>
                <div className="date-value">
                  <svg className="calendar-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M5.33333 1.33334V3.33334M10.6667 1.33334V3.33334M2.33333 6.06667H13.6667M3.33333 2.33334H12.6667C13.219 2.33334 13.6667 2.78106 13.6667 3.33334V12.6667C13.6667 13.219 13.219 13.6667 12.6667 13.6667H3.33333C2.78105 13.6667 2.33333 13.219 2.33333 12.6667V3.33334C2.33333 2.78106 2.78105 2.33334 3.33333 2.33334Z" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{formatDate(startDate)}</span>
                </div>
                <input
                  type="date"
                  className="date-input-hidden"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="date-picker">
                <span className="date-label">End Date</span>
                <div className="date-value">
                  <svg className="calendar-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M5.33333 1.33334V3.33334M10.6667 1.33334V3.33334M2.33333 6.06667H13.6667M3.33333 2.33334H12.6667C13.219 2.33334 13.6667 2.78106 13.6667 3.33334V12.6667C13.6667 13.219 13.219 13.6667 12.6667 13.6667H3.33333C2.78105 13.6667 2.33333 13.219 2.33333 12.6667V3.33334C2.33333 2.78106 2.78105 2.33334 3.33333 2.33334Z" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{formatDate(endDate)}</span>
                </div>
                <input
                  type="date"
                  className="date-input-hidden"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>
          </div>

          {/* Create Button */}
          <button 
            className="create-button"
            onClick={handleSubmit}
            disabled={!tripName || !startDate || !endDate}
          >
            Create Trip
          </button>
        </div>
      </div>
    </div>
  );
}

