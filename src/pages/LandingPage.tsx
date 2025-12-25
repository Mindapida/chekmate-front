import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

// 비행기 창문 SVG 컴포넌트 (Figma 디자인 정확히 구현)
const AirplaneWindowIcon = () => (
  <svg 
    width="200" 
    height="260" 
    viewBox="0 0 200 260" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="airplane-window-svg"
  >
    {/* 바깥쪽 창문 프레임 - 회색 둥근 사각형 */}
    <rect 
      x="25" 
      y="20" 
      width="150" 
      height="220" 
      rx="75" 
      ry="75"
      fill="#c4c9cf"
      stroke="#2d3436"
      strokeWidth="5"
    />
    
    {/* 안쪽 창문 영역 - 흰색 테두리 */}
    <rect 
      x="40" 
      y="35" 
      width="120" 
      height="190" 
      rx="60" 
      ry="60"
      fill="white"
      stroke="#2d3436"
      strokeWidth="4"
    />
    
    {/* 클리핑 영역 정의 */}
    <defs>
      <clipPath id="innerWindowClip">
        <rect x="48" y="43" width="104" height="174" rx="52" ry="52"/>
      </clipPath>
    </defs>
    
    {/* 안쪽 하늘색 배경 */}
    <rect 
      x="48" 
      y="43" 
      width="104" 
      height="174" 
      rx="52" 
      ry="52"
      fill="#b8e4f0"
    />
    
    {/* 창문 블라인드/쉐이드 (상단 회색 부분) */}
    <g clipPath="url(#innerWindowClip)">
      {/* 블라인드 메인 */}
      <rect x="48" y="43" width="104" height="75" fill="#a0aab4"/>
      {/* 블라인드 하단 라인 */}
      <rect x="48" y="113" width="104" height="8" fill="#8892a0"/>
      {/* 블라인드 손잡이 영역 */}
      <ellipse cx="100" cy="75" rx="12" ry="6" fill="#7a8490"/>
      {/* 작은 점들 */}
      <circle cx="100" cy="75" r="4" fill="#4a5058"/>
      <circle cx="85" cy="90" r="3" fill="#4a5058"/>
    </g>
    
    {/* 구름 */}
    <g clipPath="url(#innerWindowClip)">
      {/* 흰 구름 배경 */}
      <ellipse cx="75" cy="185" rx="40" ry="25" fill="white"/>
      <ellipse cx="100" cy="175" rx="35" ry="22" fill="white"/>
      <ellipse cx="130" cy="188" rx="32" ry="20" fill="white"/>
      <ellipse cx="60" cy="195" rx="25" ry="18" fill="white"/>
      <ellipse cx="105" cy="200" rx="45" ry="25" fill="white"/>
      
      {/* 구름 테두리 라인 */}
      <path 
        d="M48 200 Q60 165 85 168 Q105 155 125 165 Q145 158 152 185" 
        stroke="#2d3436" 
        strokeWidth="4" 
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    
    {/* 안쪽 창문 테두리 다시 그리기 */}
    <rect 
      x="48" 
      y="43" 
      width="104" 
      height="174" 
      rx="52" 
      ry="52"
      fill="none"
      stroke="#2d3436"
      strokeWidth="4"
    />
    
    {/* 오른쪽 작은 점들 (리벳) */}
    <circle cx="165" cy="100" r="4" fill="#2d3436"/>
    <circle cx="165" cy="130" r="4" fill="#2d3436"/>
    <circle cx="165" cy="160" r="4" fill="#2d3436"/>
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

