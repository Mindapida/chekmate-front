import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTrips } from '../context/TripContext';
import BottomNav from '../components/BottomNav';
import AddTripModal from '../components/AddTripModal';
import './HomePage.css';

const TRIP_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { trips, isLoading, createTrip } = useTrips();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTripClick = (tripId: number) => navigate(`/trip/${tripId}`);
  const handleAddTrip = () => setIsModalOpen(true);

  const handleCreateTrip = async (tripData: { name: string; startDate: string; endDate: string }) => {
    await createTrip(tripData);
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
      <div className="home-content">
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
              {trips.map((trip, index) => (
                <div key={trip.id} className="trip-card" onClick={() => handleTripClick(trip.id)}>
                  <div className="trip-icon" style={{ backgroundColor: getTripColor(index) }}>✈️</div>
                  <div className="trip-info">
                    <div className="trip-name"><span>📍</span><span>{trip.name}</span></div>
                    <div className="trip-dates"><span>📅</span><span>{formatDateRange(trip.start_date, trip.end_date)}</span></div>
                  </div>
                </div>
              ))}
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
