import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

// 비행기 창문 SVG 컴포넌트
const AirplaneWindowIcon = () => (
  <svg 
    width="192" 
    height="192" 
    viewBox="0 0 192 192" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="airplane-window-svg"
  >
    {/* 바깥쪽 창문 프레임 */}
    <ellipse 
      cx="96" 
      cy="96" 
      rx="80" 
      ry="88" 
      fill="url(#windowFrame)"
      stroke="#d4d4d8"
      strokeWidth="4"
    />
    {/* 안쪽 창문 - 하늘 */}
    <ellipse 
      cx="96" 
      cy="96" 
      rx="64" 
      ry="72" 
      fill="url(#skyGradient)"
    />
    {/* 구름들 */}
    <g opacity="0.9">
      <ellipse cx="60" cy="75" rx="25" ry="12" fill="white"/>
      <ellipse cx="80" cy="70" rx="20" ry="10" fill="white"/>
      <ellipse cx="50" cy="70" rx="15" ry="8" fill="white"/>
    </g>
    <g opacity="0.7">
      <ellipse cx="130" cy="95" rx="22" ry="10" fill="white"/>
      <ellipse cx="145" cy="90" rx="15" ry="8" fill="white"/>
    </g>
    <g opacity="0.5">
      <ellipse cx="75" cy="120" rx="18" ry="8" fill="white"/>
      <ellipse cx="90" cy="118" rx="12" ry="6" fill="white"/>
    </g>
    {/* 비행기 아이콘 */}
    <g transform="translate(105, 50) rotate(45)">
      <path 
        d="M0 12L8 8L16 12L16 16L10 14L10 24L14 28L14 32L8 28L2 32L2 28L6 24L6 14L0 16Z" 
        fill="#2b7fff"
        opacity="0.8"
      />
    </g>
    {/* 창문 반사광 */}
    <ellipse 
      cx="70" 
      cy="60" 
      rx="25" 
      ry="15" 
      fill="url(#reflection)"
      opacity="0.3"
    />
    {/* 그라데이션 정의 */}
    <defs>
      <linearGradient id="windowFrame" x1="96" y1="8" x2="96" y2="184" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f4f4f5"/>
        <stop offset="100%" stopColor="#e4e4e7"/>
      </linearGradient>
      <linearGradient id="skyGradient" x1="96" y1="24" x2="96" y2="168" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#60a5fa"/>
        <stop offset="50%" stopColor="#93c5fd"/>
        <stop offset="100%" stopColor="#bfdbfe"/>
      </linearGradient>
      <radialGradient id="reflection" cx="0.3" cy="0.3" r="0.7">
        <stop offset="0%" stopColor="white"/>
        <stop offset="100%" stopColor="white" stopOpacity="0"/>
      </radialGradient>
    </defs>
  </svg>
);

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

        {/* 비행기 창문 이미지 (SVG) */}
        <div className="airplane-image">
          <AirplaneWindowIcon />
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

