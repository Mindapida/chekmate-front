import { useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import './BottomNav.css';

interface BottomNavProps { 
  activeTab: 'home' | 'images' | 'calendar' | 'mypage'; 
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const navigate = useNavigate();
  const { currentTrip } = useTrips();

  const tabs = [
    { id: 'home', label: 'HOME', icon: '🏠', path: '/home', requiresTrip: false },
    { id: 'images', label: 'IMAGES', icon: '🖼️', path: '/images', requiresTrip: true },
    { id: 'calendar', label: 'CALENDAR', icon: '📅', path: '/calendar', requiresTrip: true },
    { id: 'mypage', label: 'MY PAGE', icon: '👤', path: '/mypage', requiresTrip: false },
  ];

  const handleTabClick = (tab: typeof tabs[0]) => {
    if (tab.requiresTrip && !currentTrip) {
      alert('Please select a trip first! ✈️\n\nGo to HOME and set a current trip.');
      return;
    }
    navigate(tab.path);
  };

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button 
          key={tab.id} 
          className={`nav-item ${activeTab === tab.id ? 'active' : ''} ${tab.requiresTrip && !currentTrip ? 'disabled' : ''}`} 
          onClick={() => handleTabClick(tab)}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
          {tab.requiresTrip && !currentTrip && (
            <span className="lock-icon">🔒</span>
          )}
        </button>
      ))}
    </nav>
  );
}
