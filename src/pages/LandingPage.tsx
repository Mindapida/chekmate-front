import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/login');
  };

  const handleSignUp = () => {
    navigate('/signup');
  };

  return (
    <div className="landing-page">
      <div className="landing-container">
        {/* 상단 부제목 */}
        <div className="subtitle-badge">
          <span>Travel Expense & Diary</span>
        </div>

        {/* 로고 */}
        <div className="logo">
          <span className="logo-check">✓</span>
          <span className="logo-text">CHECKMATE</span>
        </div>

        {/* 3D 비행기 창문 */}
        <div className="airplane-window-container">
          <div className="window-frame">
            <div className="window-view">
              <div className="sky">
                <div className="cloud-layer">
                  <span className="cloud c1">☁️</span>
                  <span className="cloud c2">☁️</span>
                  <span className="cloud c3">⛅</span>
                  <span className="cloud c4">☁️</span>
                  <span className="cloud c5">🌤️</span>
                  <span className="cloud c6">☁️</span>
                </div>
              </div>
            </div>
            <div className="window-shine"></div>
          </div>
          <div className="window-shadow"></div>
        </div>

        {/* 버튼 그룹 */}
        <div className="button-group">
          <button className="btn-login" onClick={handleLogin}>Login</button>
          <button className="btn-signup" onClick={handleSignUp}>Sign Up</button>
        </div>

        {/* 설명 텍스트 */}
        <p className="tagline">Track expenses, share memories, settle up with ease ✨</p>
      </div>
    </div>
  );
}

