import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import AddTripModal from '../components/AddTripModal';
import './HomePage.css';

interface Trip {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
}

const TRIP_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

export default function HomePage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTripClick = (tripId: number) => navigate(`/trip/${tripId}`);
  const handleAddTrip = () => setIsModalOpen(true);

  const handleCreateTrip = (tripData: { name: string; startDate: string; endDate: string }) => {
    const newTrip: Trip = {
      id: Date.now(),
      name: tripData.name,
      startDate: tripData.startDate,
      endDate: tripData.endDate,
      color: TRIP_COLORS[trips.length % TRIP_COLORS.length],
    };
    setTrips([...trips, newTrip]);
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  return (
    <div className="home-page">
      <div className="home-content">
        <header className="home-header">
          <div className="header-logo">
            <span className="logo-check">✓</span>
            <span className="logo-text">CHECKMATE</span>
          </div>
        </header>

        <div className="section-header">
          <h2>Trip & Members</h2>
          <span className="dropdown-icon">▼</span>
        </div>

        <div className="trips-container">
          {trips.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✈️</div>
              <h3>No trips yet</h3>
              <p>Start planning your adventure!</p>
              <button className="create-trip-btn" onClick={handleAddTrip}>+ Create Your First Trip</button>
            </div>
          ) : (
            <>
              {trips.map((trip) => (
                <div key={trip.id} className="trip-card" onClick={() => handleTripClick(trip.id)}>
                  <div className="trip-icon" style={{ backgroundColor: trip.color }}>✈️</div>
                  <div className="trip-info">
                    <div className="trip-name"><span>📍</span><span>{trip.name}</span></div>
                    <div className="trip-dates"><span>📅</span><span>{formatDateRange(trip.startDate, trip.endDate)}</span></div>
                  </div>
                </div>
              ))}
              <button className="add-trip-btn" onClick={handleAddTrip}><span>+</span><span>ADD TRIP</span></button>
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

