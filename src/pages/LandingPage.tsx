import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

// 비행기 창문 SVG 컴포넌트 (Figma 디자인)
const AirplaneWindowIcon = () => (
  <svg 
    width="180" 
    height="220" 
    viewBox="0 0 180 220" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="airplane-window-svg"
  >
    {/* 바깥쪽 창문 프레임 - 둥근 사각형 */}
    <rect 
      x="20" 
      y="20" 
      width="140" 
      height="180" 
      rx="70" 
      ry="70"
      fill="white"
      stroke="#3d4152"
      strokeWidth="6"
    />
    
    {/* 안쪽 창문 영역 클리핑 */}
    <defs>
      <clipPath id="windowClip">
        <rect x="35" y="35" width="110" height="150" rx="55" ry="55"/>
      </clipPath>
    </defs>
    
    {/* 안쪽 창문 배경 - 하늘색 */}
    <rect 
      x="35" 
      y="35" 
      width="110" 
      height="150" 
      rx="55" 
      ry="55"
      fill="#a8e6f0"
      stroke="#3d4152"
      strokeWidth="4"
    />
    
    {/* 창문 블라인드/쉐이드 (상단) */}
    <g clipPath="url(#windowClip)">
      <rect x="35" y="35" width="110" height="50" fill="#b8c4ce"/>
      <rect x="35" y="82" width="110" height="6" fill="#9aa8b4"/>
      {/* 블라인드 손잡이 */}
      <ellipse cx="90" cy="60" rx="8" ry="4" fill="#6b7a8a"/>
      <circle cx="90" cy="60" r="3" fill="#4a5568"/>
      <circle cx="80" cy="68" r="2" fill="#4a5568"/>
    </g>
    
    {/* 구름 */}
    <g clipPath="url(#windowClip)">
      {/* 메인 구름 */}
      <ellipse cx="70" cy="145" rx="35" ry="18" fill="white"/>
      <ellipse cx="95" cy="140" rx="28" ry="16" fill="white"/>
      <ellipse cx="115" cy="148" rx="25" ry="14" fill="white"/>
      <ellipse cx="55" cy="150" rx="20" ry="12" fill="white"/>
      <ellipse cx="85" cy="155" rx="30" ry="15" fill="white"/>
      
      {/* 구름 테두리 */}
      <path 
        d="M35 155 Q50 130 75 132 Q95 125 115 135 Q135 130 145 150" 
        stroke="#3d4152" 
        strokeWidth="3" 
        fill="none"
        strokeLinecap="round"
      />
    </g>
    
    {/* 안쪽 창문 테두리 (다시 그리기) */}
    <rect 
      x="35" 
      y="35" 
      width="110" 
      height="150" 
      rx="55" 
      ry="55"
      fill="none"
      stroke="#3d4152"
      strokeWidth="4"
    />
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
          <span className="logo-airplane">✈</span>
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

