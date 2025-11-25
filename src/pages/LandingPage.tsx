import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

// Figma 비행기 창문 이미지
const imgAirplaneWindow = "https://www.figma.com/api/mcp/asset/460365c9-662c-4e42-8651-9ff270d1d803";

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

        {/* 비행기 창문 이미지 */}
        <div className="airplane-image">
          <img src={imgAirplaneWindow} alt="Airplane Window" />
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

