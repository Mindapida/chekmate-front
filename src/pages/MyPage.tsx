import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTrips } from '../context/TripContext';
import BottomNav from '../components/BottomNav';
import './MyPage.css';

export default function MyPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentTrip, trips } = useTrips();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const budget = 1000000;
  const spent = 450000;
  const remaining = budget - spent;
  const percentage = Math.round((spent / budget) * 100);

  return (
    <div className="mypage">
      <div className="page-content">
        <header className="page-header">
          <div className="header-left">
            <div className="header-logo">
              <span className="logo-check">✓</span>
              <span className="logo-text">CHECKMATE</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H6M10.6667 11.3333L14 8M14 8L10.6667 4.66667M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Logout
          </button>
        </header>

        <div className="welcome-bar">
          Welcome, {user?.username || 'Guest'} 👋
        </div>

        {currentTrip && (
          <div className="current-trip-banner">
            <span>✈️</span>
            <span>Current Trip: {currentTrip.name}</span>
          </div>
        )}

        <div className="budget-section">
          <div className="section-header">
            <h2>My Budget</h2>
            <button className="edit-btn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M11.334 2.00004C11.5091 1.82494 11.7169 1.68605 11.9457 1.59129C12.1745 1.49653 12.4197 1.44775 12.6673 1.44775C12.915 1.44775 13.1602 1.49653 13.389 1.59129C13.6178 1.68605 13.8256 1.82494 14.0007 2.00004C14.1758 2.17513 14.3147 2.383 14.4094 2.61178C14.5042 2.84055 14.553 3.08575 14.553 3.33337C14.553 3.58099 14.5042 3.82619 14.4094 4.05497C14.3147 4.28374 14.1758 4.49161 14.0007 4.66671L5.00065 13.6667L1.33398 14.6667L2.33398 11L11.334 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Edit
            </button>
          </div>

          <div className="budget-stats">
            <div className="stat-box">
              <span className="stat-label">Budget</span>
              <span className="stat-value">{(budget / 1000).toFixed(0)}K ₩</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Spending</span>
              <span className="stat-value">{(spent / 1000).toFixed(0)}K ₩</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Remaining</span>
              <span className="stat-value green">{(remaining / 1000).toFixed(0)}K ₩</span>
            </div>
          </div>

          <div className="budget-visual">
            <div className="coin">
              <div className="coin-inner">
                <span className="currency">₩</span>
                <span className="percent">{percentage}%</span>
              </div>
              <svg className="progress-ring" viewBox="0 0 120 120">
                <circle className="progress-bg" cx="60" cy="60" r="54" />
                <circle 
                  className="progress-bar" 
                  cx="60" 
                  cy="60" 
                  r="54"
                  style={{ strokeDashoffset: 339.3 - (339.3 * percentage / 100) }}
                />
              </svg>
            </div>
            <div className="budget-info">
              <span>{percentage}% used</span>
              <span className="remaining">{remaining.toLocaleString()} KRW left</span>
            </div>
          </div>
        </div>

        <div className="categories-section">
          <h2>Top Spending Categories</h2>
          
          <div className="category">
            <span className="rank">🥇</span>
            <div className="category-info">
              <span className="cat-name">Food & Dining</span>
              <div className="progress-bar-container">
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: '70%' }}></div>
                </div>
                <span className="cat-percent">70%</span>
              </div>
            </div>
          </div>

          <div className="category">
            <span className="rank">🥈</span>
            <div className="category-info">
              <span className="cat-name">Shopping</span>
              <div className="progress-bar-container">
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: '50%' }}></div>
                </div>
                <span className="cat-percent">50%</span>
              </div>
            </div>
          </div>

          <div className="category">
            <span className="rank">🥉</span>
            <div className="category-info">
              <span className="cat-name">Transportation</span>
              <div className="progress-bar-container">
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: '30%' }}></div>
                </div>
                <span className="cat-percent">30%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="trips-summary">
          <h3>Total Trips: {trips.length}</h3>
        </div>
      </div>
      <BottomNav activeTab="mypage" />
    </div>
  );
}

