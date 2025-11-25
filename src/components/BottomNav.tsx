import { useNavigate } from 'react-router-dom';
import './BottomNav.css';

interface BottomNavProps { activeTab: 'home' | 'images' | 'calendar' | 'mypage'; }

export default function BottomNav({ activeTab }: BottomNavProps) {
  const navigate = useNavigate();
  const tabs = [
    { id: 'home', label: 'HOME', icon: '🏠', path: '/home' },
    { id: 'images', label: 'IMAGES', icon: '🖼️', path: '/images' },
    { id: 'calendar', label: 'CALENDAR', icon: '📅', path: '/calendar' },
    { id: 'mypage', label: 'MY PAGE', icon: '👤', path: '/mypage' },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button key={tab.id} className={`nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => navigate(tab.path)}>
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

