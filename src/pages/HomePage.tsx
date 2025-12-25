import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTrips } from '../context/TripContext';
import BottomNav, { saveLastPage } from '../components/BottomNav';
import AddTripModal from '../components/AddTripModal';
import './HomePage.css';

const TRIP_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

// Helper to get trip stats from localStorage
const getTripStats = (tripId: number, startDate: string, endDate: string) => {
  let expenseCount = 0;
  let photoCount = 0;
  
  // Count expenses
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const stored = localStorage.getItem(`expenses_${tripId}_${dateStr}`);
    if (stored) {
      expenseCount += JSON.parse(stored).length;
    }
  }
  
  // Count photos
  const expensePhotos = localStorage.getItem(`expense_photos_${tripId}`);
  if (expensePhotos) {
    const photoData = JSON.parse(expensePhotos);
    Object.values(photoData).forEach((arr: any) => {
      photoCount += arr.length;
    });
  }
  const dumpPhotos = localStorage.getItem(`photo_dump_${tripId}`);
  if (dumpPhotos) {
    const dumpData = JSON.parse(dumpPhotos);
    Object.values(dumpData).forEach((arr: any) => {
      photoCount += arr.length;
    });
  }
  
  // Count participants
  const participants = localStorage.getItem(`trip_participants_${tripId}`);
  const participantCount = participants ? JSON.parse(participants).length : 0;
  
  return { expenseCount, photoCount, participantCount };
};

export default function HomePage() {
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Save current page on mount
  useEffect(() => {
    saveLastPage('/home');
  }, []);
  
  const { user, logout } = useAuth();
  const { trips, currentTrip, setCurrentTrip, isLoading, createTrip } = useTrips();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showTripSelector, setShowTripSelector] = useState(false);
  const [tripStats, setTripStats] = useState<{ [tripId: number]: { expenseCount: number; photoCount: number; participantCount: number } }>({});

  // Load stats for all trips
  const loadAllTripStats = useCallback(() => {
    const stats: { [tripId: number]: { expenseCount: number; photoCount: number; participantCount: number } } = {};
    trips.forEach(trip => {
      stats[trip.id] = getTripStats(trip.id, trip.start_date, trip.end_date);
    });
    setTripStats(stats);
  }, [trips]);

  useEffect(() => {
    loadAllTripStats();
  }, [loadAllTripStats]);

  // Scroll to top on mount and when trips/currentTrip change
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [trips, currentTrip]);

  const handleTripClick = (tripId: number) => navigate(`/trip/${tripId}`);
  const handleAddTrip = () => setIsModalOpen(true);

  const handleCreateTrip = async (tripData: { name: string; startDate: string; endDate: string }) => {
    const newTrip = await createTrip(tripData);
    // Auto-set as current trip if it's the first one
    if (trips.length === 0) {
      setCurrentTrip(newTrip);
    }
  };

  const handleSetCurrentTrip = (e: React.MouseEvent, trip: typeof trips[0]) => {
    e.stopPropagation();
    setCurrentTrip(trip);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  const getTripColor = (index: number) => TRIP_COLORS[index % TRIP_COLORS.length];

  return (
    <div className="home-page">
      <div className="home-content" ref={contentRef}>
        <header className="home-header">
          <div className="header-logo">
            <span className="logo-check">✓</span>
            <span className="logo-text">CHECKMATE</span>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 17H4C3.46957 17 2.96086 16.7893 2.58579 16.4142C2.21071 16.0391 2 15.5304 2 15V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H7M13 14L17 10M17 10L13 6M17 10H7" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </header>

        {user && (
          <div className="welcome-message">
            Welcome, <strong>{user.username}</strong> 👋
          </div>
        )}

        {/* Current Trip Selector */}
        {trips.length > 0 && (
          <div className="current-trip-section">
            <div 
              className="current-trip-selector"
              onClick={() => setShowTripSelector(!showTripSelector)}
            >
              <div className="selector-label">Current Trip</div>
              <div className="selector-value">
                {currentTrip ? (
                  <>
                    <span className="trip-emoji">✈️</span>
                    <span className="trip-name-text">{currentTrip.name}</span>
                  </>
                ) : (
                  <span className="no-trip">Select a trip</span>
                )}
                <svg className={`chevron ${showTripSelector ? 'open' : ''}`} width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            
            {showTripSelector && (
              <div className="trip-dropdown">
                {trips.map((trip, index) => (
                  <button
                    key={trip.id}
                    className={`dropdown-item ${currentTrip?.id === trip.id ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentTrip(trip);
                      setShowTripSelector(false);
                    }}
                  >
                    <div className="dropdown-trip-icon" style={{ backgroundColor: getTripColor(index) }}>✈️</div>
                    <div className="dropdown-trip-info">
                      <span className="dropdown-trip-name">{trip.name}</span>
                      <span className="dropdown-trip-dates">{formatDateRange(trip.start_date, trip.end_date)}</span>
                    </div>
                    {currentTrip?.id === trip.id && (
                      <span className="check-icon">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="section-header">
          <h2>Trip & Members</h2>
          <span className="dropdown-icon">▼</span>
        </div>

        <div className="trips-container">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner">✈️</div>
              <p>Loading your trips...</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✈️</div>
              <h3>No trips yet</h3>
              <p>Start planning your adventure!</p>
              <button className="create-trip-btn" onClick={handleAddTrip}>+ Create Your First Trip</button>
            </div>
          ) : (
            <>
              {trips.map((trip, index) => {
                const stats = tripStats[trip.id] || { expenseCount: 0, photoCount: 0, participantCount: 0 };
                return (
                  <div 
                    key={trip.id} 
                    className={`trip-card ${currentTrip?.id === trip.id ? 'current' : ''}`} 
                    onClick={() => handleTripClick(trip.id)}
                  >
                    <div className="trip-icon" style={{ backgroundColor: getTripColor(index) }}>✈️</div>
                    <div className="trip-info">
                      <div className="trip-name">
                        <span>📍</span>
                        <span>{trip.name}</span>
                        {currentTrip?.id === trip.id && <span className="current-badge">Current</span>}
                      </div>
                      <div className="trip-dates"><span>📅</span><span>{formatDateRange(trip.start_date, trip.end_date)}</span></div>
                      <div className="trip-stats-mini">
                        <span className="stat-mini">👥 {stats.participantCount}</span>
                        <span className="stat-mini">💰 {stats.expenseCount}</span>
                        <span className="stat-mini">📷 {stats.photoCount}</span>
                      </div>
                    </div>
                    <button 
                      className={`set-current-btn ${currentTrip?.id === trip.id ? 'active' : ''}`}
                      onClick={(e) => handleSetCurrentTrip(e, trip)}
                      title={currentTrip?.id === trip.id ? 'Current trip' : 'Set as current'}
                    >
                      {currentTrip?.id === trip.id ? '★' : '☆'}
                    </button>
                  </div>
                );
              })}
              <button className="add-trip-btn" onClick={handleAddTrip}>
                <span>+</span>
                <span>New Adventure</span>
                <span className="btn-airplane">✈️</span>
              </button>
            </>
          )}
        </div>
      </div>
      <BottomNav activeTab="home" />
      
      <AddTripModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateTrip={handleCreateTrip}
      />
    </div>
  );
}
