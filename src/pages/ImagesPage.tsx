import { useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import BottomNav from '../components/BottomNav';
import './ImagesPage.css';

export default function ImagesPage() {
  const navigate = useNavigate();
  const { currentTrip } = useTrips();

  if (!currentTrip) {
    return (
      <div className="images-page">
        <div className="no-trip-message">
          <span>✈️</span>
          <h2>No trip selected</h2>
          <p>Please select a current trip first</p>
          <button onClick={() => navigate('/home')}>Go to Home</button>
        </div>
        <BottomNav activeTab="images" />
      </div>
    );
  }

  return (
    <div className="images-page">
      <div className="page-content">
        <header className="page-header">
          <div className="header-logo">
            <span className="logo-check">✓</span>
            <span className="logo-text">CHECKMATE</span>
          </div>
        </header>

        <div className="trip-info-bar">
          <div className="trip-name-display">
            <span>🖼️</span>
            <span>{currentTrip.name.toUpperCase()}</span>
          </div>
          <span className="trip-dates-small">
            📅 {currentTrip.start_date} - {currentTrip.end_date}
          </span>
        </div>

        <div className="images-container">
          <div className="empty-images">
            <div className="empty-icon">📸</div>
            <h3>No photos yet</h3>
            <p>Photos from your trip will appear here</p>
            <button className="upload-btn">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Upload Photos
            </button>
          </div>
        </div>

        <div className="stats-bar">
          <div className="stat">
            <span className="stat-num">0</span>
            <span className="stat-label">Photos</span>
          </div>
          <div className="stat">
            <span className="stat-num">0</span>
            <span className="stat-label">Days</span>
          </div>
        </div>
      </div>
      <BottomNav activeTab="images" />
    </div>
  );
}

