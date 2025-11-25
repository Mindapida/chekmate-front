import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import './HomePage.css';

const trips: { id: number; name: string; startDate: string; endDate: string; color: string; }[] = [];

export default function HomePage() {
  const navigate = useNavigate();
  const handleTripClick = (tripId: number) => navigate(`/trip/${tripId}`);
  const handleAddTrip = () => console.log('Add Trip clicked');

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
                    <div className="trip-dates"><span>📅</span><span>{trip.startDate} - {trip.endDate}</span></div>
                  </div>
                </div>
              ))}
              <button className="add-trip-btn" onClick={handleAddTrip}><span>+</span><span>ADD TRIP</span></button>
            </>
          )}
        </div>
      </div>
      <BottomNav activeTab="home" />
    </div>
  );
}

