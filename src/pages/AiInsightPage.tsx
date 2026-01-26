import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTrips } from '../context/TripContext';
import { expensesApi } from '../api';
import type { Expense } from '../types/api';
import BottomNav, { saveLastPage } from '../components/BottomNav';
import './AiInsightPage.css';

// Storage key
const EXPENSE_STORAGE_KEY = 'expenses';

// Category mapping
const CATEGORY_MAP: { [key: string]: { name: string; nameKr: string; emoji: string; color: string } } = {
  'food': { name: 'Food & Dining', nameKr: '식비', emoji: '🍽️', color: '#FF6B6B' },
  'drinks': { name: 'Drinks', nameKr: '음료/술', emoji: '🍺', color: '#4ECDC4' },
  'transport': { name: 'Transportation', nameKr: '교통비', emoji: '🚗', color: '#45B7D1' },
  'hotel': { name: 'Accommodation', nameKr: '숙박비', emoji: '🏨', color: '#96CEB4' },
  'shopping': { name: 'Shopping', nameKr: '쇼핑', emoji: '🛍️', color: '#FFEAA7' },
  'activity': { name: 'Activities', nameKr: '액티비티', emoji: '🎭', color: '#DDA0DD' },
  'ticket': { name: 'Tickets', nameKr: '티켓', emoji: '🎫', color: '#98D8C8' },
  'gift': { name: 'Gifts', nameKr: '선물', emoji: '🎁', color: '#F7DC6F' },
  'cafe': { name: 'Cafe', nameKr: '카페', emoji: '☕', color: '#D4A574' },
};

// City averages (simulated data in KRW)
const CITY_AVERAGES: { [key: string]: number } = {
  'food': 30000,
  'drinks': 15000,
  'transport': 12000,
  'hotel': 80000,
  'shopping': 50000,
  'activity': 25000,
  'ticket': 20000,
  'gift': 30000,
  'cafe': 8000,
};

// Exchange rates to KRW
const EXCHANGE_RATES_TO_KRW: { [key: string]: number } = {
  'KRW': 1,
  'USD': 1350,
  'JPY': 9,
  'EUR': 1450,
  'GBP': 1700,
  'CNY': 190,
  'AUD': 870,
};

// Demo data for display
const DEMO_DATA = [
  { category: 'food', nameKr: '식비', emoji: '🍽️', amountKRW: 156000, count: 8, color: '#FF6B6B', trend: 23, avgPerItem: 19500 },
  { category: 'transport', nameKr: '교통비', emoji: '🚗', amountKRW: 45000, count: 5, color: '#45B7D1', trend: -8, avgPerItem: 9000 },
  { category: 'shopping', nameKr: '쇼핑', emoji: '🛍️', amountKRW: 89000, count: 3, color: '#FFEAA7', trend: 15, avgPerItem: 29667 },
  { category: 'cafe', nameKr: '카페', emoji: '☕', amountKRW: 32000, count: 6, color: '#D4A574', trend: 5, avgPerItem: 5333 },
  { category: 'activity', nameKr: '액티비티', emoji: '🎭', amountKRW: 75000, count: 2, color: '#DDA0DD', trend: -12, avgPerItem: 37500 },
  { category: 'drinks', nameKr: '음료/술', emoji: '🍺', amountKRW: 28000, count: 4, color: '#4ECDC4', trend: 0, avgPerItem: 7000 },
];

interface CategoryData {
  category: string;
  name?: string;
  nameKr: string;
  emoji: string;
  amount?: number;
  amountKRW: number;
  count: number;
  color: string;
  trend?: number;
  avgPerItem?: number;
}

// AI Face expressions - Super cute character
type FaceType = 'happy' | 'thinking' | 'surprised' | 'worried' | 'proud' | 'wink' | 'neutral';

const AIFace = ({ type, talking }: { type: FaceType; talking: boolean }) => {
  return (
    <div className={`cute-character ${talking ? 'talking' : ''}`}>
      <svg viewBox="0 0 100 100" className="character-svg">
        {/* Soft shadow */}
        <ellipse cx="50" cy="92" rx="30" ry="6" fill="rgba(0,0,0,0.08)" />
        
        {/* Body - soft gradient */}
        <defs>
          <radialGradient id="bodyGrad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFE5A0" />
            <stop offset="50%" stopColor="#FFD666" />
            <stop offset="100%" stopColor="#FFB830" />
          </radialGradient>
          <radialGradient id="blushGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFB5B5" />
            <stop offset="100%" stopColor="#FFB5B5" stopOpacity="0" />
          </radialGradient>
        </defs>
        
        {/* Main body */}
        <circle cx="50" cy="50" r="40" fill="url(#bodyGrad)" />
        
        {/* Highlight */}
        <ellipse cx="35" cy="30" rx="12" ry="8" fill="rgba(255,255,255,0.5)" />
        
        {/* Blush */}
        <circle cx="25" cy="55" r="8" fill="url(#blushGrad)" />
        <circle cx="75" cy="55" r="8" fill="url(#blushGrad)" />
        
        {/* Eyes based on expression */}
        {type === 'happy' || type === 'proud' ? (
          <>
            {/* Happy curved eyes */}
            <path d="M32 45 Q38 38, 44 45" stroke="#3D2314" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M56 45 Q62 38, 68 45" stroke="#3D2314" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : type === 'wink' ? (
          <>
            {/* One eye open, one wink */}
            <circle cx="38" cy="42" r="5" fill="#3D2314" />
            <circle cx="40" cy="40" r="2" fill="#FFF" />
            <path d="M56 45 Q62 40, 68 45" stroke="#3D2314" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : type === 'thinking' ? (
          <>
            {/* Looking to side */}
            <circle cx="40" cy="42" r="5" fill="#3D2314" />
            <circle cx="42" cy="40" r="2" fill="#FFF" />
            <circle cx="66" cy="42" r="5" fill="#3D2314" />
            <circle cx="68" cy="40" r="2" fill="#FFF" />
          </>
        ) : type === 'worried' ? (
          <>
            {/* Worried eyes with eyebrows */}
            <circle cx="38" cy="44" r="5" fill="#3D2314" />
            <circle cx="40" cy="42" r="2" fill="#FFF" />
            <circle cx="62" cy="44" r="5" fill="#3D2314" />
            <circle cx="64" cy="42" r="2" fill="#FFF" />
            <path d="M30 34 L44 38" stroke="#3D2314" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M70 34 L56 38" stroke="#3D2314" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* Normal cute eyes */}
            <circle cx="38" cy="42" r="5" fill="#3D2314" />
            <circle cx="40" cy="40" r="2" fill="#FFF" />
            <circle cx="62" cy="42" r="5" fill="#3D2314" />
            <circle cx="64" cy="40" r="2" fill="#FFF" />
          </>
        )}
        
        {/* Mouth based on expression */}
        {type === 'happy' || type === 'proud' || type === 'wink' ? (
          <path 
            d="M42 58 Q50 68, 58 58" 
            stroke="#3D2314" 
            strokeWidth="2.5" 
            fill="none" 
            strokeLinecap="round"
            className={talking ? 'mouth-talk' : ''}
          />
        ) : type === 'worried' ? (
          <path 
            d="M42 62 Q50 56, 58 62" 
            stroke="#3D2314" 
            strokeWidth="2.5" 
            fill="none" 
            strokeLinecap="round"
            className={talking ? 'mouth-talk' : ''}
          />
        ) : type === 'surprised' ? (
          <ellipse cx="50" cy="60" rx="5" ry="6" fill="#3D2314" className={talking ? 'mouth-talk' : ''} />
        ) : (
          <path 
            d="M44 58 Q50 62, 56 58" 
            stroke="#3D2314" 
            strokeWidth="2.5" 
            fill="none" 
            strokeLinecap="round"
            className={talking ? 'mouth-talk' : ''}
          />
        )}
        
        {/* Sparkles for proud */}
        {type === 'proud' && (
          <>
            <text x="12" y="25" fontSize="12" className="sparkle-anim">✨</text>
            <text x="78" y="20" fontSize="10" className="sparkle-anim delay">✨</text>
          </>
        )}
        
        {/* Thinking bubble */}
        {type === 'thinking' && (
          <>
            <circle cx="80" cy="22" r="4" fill="#E0D4F7" />
            <circle cx="88" cy="14" r="3" fill="#E0D4F7" />
            <circle cx="94" cy="8" r="2" fill="#E0D4F7" />
          </>
        )}
      </svg>
    </div>
  );
};

export default function AiInsightPage() {
  const { user } = useAuth();
  const { currentTrip } = useTrips();
  
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const [showEntryPopup, setShowEntryPopup] = useState(false);

  // Save current page
  useEffect(() => {
    saveLastPage('/ai-insight');
  }, []);

  // Show entry popup when page loads
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowEntryPopup(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Load expenses
  const loadExpenses = useCallback(async () => {
    if (!currentTrip) {
      setCategoryData(DEMO_DATA);
      setUseDemo(true);
      return;
    }

    setLoading(true);
    const allExpenses: Expense[] = [];

    const startDate = new Date(currentTrip.start_date);
    const endDate = new Date(currentTrip.end_date);
    const today = new Date();

    const currentDate = new Date(startDate);
    while (currentDate <= endDate && currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      try {
        const backendExpenses = await expensesApi.getByDate(currentTrip.id, dateStr);
        if (backendExpenses && backendExpenses.length > 0) {
          allExpenses.push(...backendExpenses);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
      } catch (error) {
        console.log(`Backend failed for ${dateStr}, trying localStorage...`);
      }
      
      const storageKey = `${EXPENSE_STORAGE_KEY}_${currentTrip.id}_${dateStr}`;
      const storedExpenses = localStorage.getItem(storageKey);
      
      if (storedExpenses) {
        try {
          const dayExpenses = JSON.parse(storedExpenses);
          allExpenses.push(...dayExpenses);
        } catch (e) {
          console.error('Failed to parse expenses for', dateStr, e);
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (allExpenses.length === 0) {
      setCategoryData(DEMO_DATA);
      setUseDemo(true);
      setLoading(false);
      return;
    }

    setUseDemo(false);

    const categoryTotals: { [key: string]: { amount: number; amountKRW: number; count: number } } = {};
    
    allExpenses.forEach(exp => {
      if (exp.category) {
        const cat = exp.category.toLowerCase().trim();
        const expAmount = typeof exp.amount === 'number' ? exp.amount : parseFloat(exp.amount) || 0;
        const expCurrency = exp.currency || 'KRW';
        const rate = EXCHANGE_RATES_TO_KRW[expCurrency] || 1;
        const amountKRW = expAmount * rate;
        
        if (!categoryTotals[cat]) {
          categoryTotals[cat] = { amount: 0, amountKRW: 0, count: 0 };
        }
        categoryTotals[cat].amount += expAmount;
        categoryTotals[cat].amountKRW += amountKRW;
        categoryTotals[cat].count += 1;
      }
    });

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b.amountKRW - a.amountKRW)
      .map(([cat, data]) => {
        const info = CATEGORY_MAP[cat] || { name: cat, nameKr: cat, emoji: '📝', color: '#999' };
        const avgAmount = CITY_AVERAGES[cat] || 20000;
        const avgPerItem = data.count > 0 ? Math.round(data.amountKRW / data.count) : 0;
        const trend = Math.round((avgPerItem / avgAmount - 1) * 100);
        
        return {
          category: cat,
          name: info.name,
          nameKr: info.nameKr,
          emoji: info.emoji,
          amount: Math.round(data.amount),
          amountKRW: Math.round(data.amountKRW),
          count: data.count,
          color: info.color,
          trend,
          avgPerItem,
        };
      });

    setCategoryData(sortedCategories);
    setLoading(false);
  }, [currentTrip]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Generate AI insight with personalized feedback
  const getInsight = useMemo(() => {
    if (!selectedCategory) return null;
    
    const data = categoryData.find(c => c.category === selectedCategory);
    if (!data) return null;

    const userName = user?.username || '회원';
    const trend = data.trend || 0;
    const cityName = currentTrip?.destination || '이 도시';
    const avgPerItem = data.avgPerItem || 0;

    let message = '';
    let subMessage = '';
    let face: FaceType = 'neutral';
    let tag = '';
    let tagColor = '';

    // Context-aware, personalized feedback based on the spec
    if (trend > 30) {
      face = 'worried';
      tag = '주의';
      tagColor = '#FF6B6B';
      message = `${data.nameKr} 지출이 ${cityName} 평균 대비 약 +${trend}% 수준이에요.`;
      subMessage = `${userName}님의 평소 ${data.nameKr} 패턴보다도 다소 높은 편이에요.`;
    } else if (trend > 15) {
      face = 'thinking';
      tag = '참고';
      tagColor = '#FFB347';
      message = `${data.nameKr}는 ${cityName} 평균 대비 약 +${trend}% 수준이며,`;
      subMessage = `${userName}님의 평소 ${data.nameKr} 패턴보다도 다소 높은 편이에요.`;
    } else if (trend > -10) {
      face = 'happy';
      tag = '적정';
      tagColor = '#4ECDC4';
      message = `${data.nameKr}는 ${cityName} 평균과 비슷한 수준이에요!`;
      subMessage = `${userName}님의 평소 소비 패턴 범위 안에 있어요.`;
    } else if (trend > -25) {
      face = 'wink';
      tag = '절약';
      tagColor = '#96CEB4';
      message = `${data.nameKr}를 ${cityName} 평균보다 ${Math.abs(trend)}% 절약하고 있어요!`;
      subMessage = `${userName}님 알뜰하시네요! 아낀 금액으로 특별한 경험을 해보는 건 어떨까요?`;
    } else {
      face = 'proud';
      tag = '최고';
      tagColor = '#A78BFA';
      message = `와! ${data.nameKr}를 ${Math.abs(trend)}%나 절약 중이에요!`;
      subMessage = `${userName}님의 스마트한 소비 습관이 빛을 발하고 있어요. 정말 대단해요!`;
    }

    return { 
      message, 
      subMessage, 
      face, 
      data, 
      trend, 
      tag, 
      tagColor,
      avgPerItem,
      cityName 
    };
  }, [selectedCategory, categoryData, user?.username, currentTrip?.destination]);

  const handleCategoryClick = (category: string) => {
    if (selectedCategory === category) {
      setShowBubble(false);
      setTimeout(() => setSelectedCategory(null), 300);
    } else {
      setSelectedCategory(category);
      setShowBubble(true);
    }
  };

  const totalSpent = categoryData.reduce((sum, cat) => sum + cat.amountKRW, 0);
  const totalCount = categoryData.reduce((sum, cat) => sum + cat.count, 0);

  // Default face when not selected
  const defaultFace: FaceType = 'neutral';
  const currentFace = getInsight?.face || defaultFace;

  // Get taxi expense notification
  const getEntryNotification = useMemo(() => {
    const cityName = currentTrip?.destination || '이 도시';
    return { emoji: '🚕', category: '택시', percent: 30, type: 'high' as const, cityName };
  }, [currentTrip?.destination]);

  return (
    <div className="ai-insight-page">
      {/* Entry Popup */}
      {showEntryPopup && (
        <div className="entry-popup-overlay" onClick={() => setShowEntryPopup(false)}>
          <div className="entry-popup" onClick={(e) => e.stopPropagation()}>
            <button className="popup-close" onClick={() => setShowEntryPopup(false)}>×</button>
            <div className="popup-icon">{getEntryNotification.emoji}</div>
            <div className="popup-content">
              <h3>💡 AI 알림</h3>
              <p className="popup-main-text">
                방금 <strong>{getEntryNotification.category}</strong> 결제 내역은{' '}
                <span className={`highlight ${getEntryNotification.type}`}>
                  {getEntryNotification.cityName} 평균 대비 {getEntryNotification.type === 'high' ? '+' : '-'}{getEntryNotification.percent}%
                </span>
                {getEntryNotification.type === 'high' ? '가 높습니다.' : '로 절약했어요!'}
              </p>
              <p className="popup-sub-text">
                {getEntryNotification.type === 'high' 
                  ? '카테고리를 탭해서 자세한 분석을 확인해보세요.'
                  : '스마트한 소비 습관이에요! 계속 유지해보세요.'}
              </p>
            </div>
            <button className="popup-button" onClick={() => setShowEntryPopup(false)}>
              확인했어요
            </button>
          </div>
        </div>
      )}

      <div className="page-content">
        {/* Header */}
        <header className="ai-header">
          <div className="header-bg"></div>
          <div className="header-content">
            <span className="header-badge">AI 분석</span>
            <h1>가격 감각 알리미</h1>
            <p>환율 · 현지 물가 · 개인 소비 패턴을 종합 분석해요</p>
          </div>
        </header>

        {/* Stats Summary */}
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-icon-wrap">
              <span className="stat-icon">💰</span>
            </div>
            <div className="stat-info">
              <span className="stat-label">총 지출</span>
              <span className="stat-value">₩{totalSpent.toLocaleString()}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap">
              <span className="stat-icon">📝</span>
            </div>
            <div className="stat-info">
              <span className="stat-label">거래</span>
              <span className="stat-value">{totalCount}건</span>
            </div>
          </div>
        </div>


        {/* AI Interaction Area */}
        <div className="ai-interaction-area">
          <div className="ai-character-wrapper">
            <AIFace type={currentFace} talking={showBubble} />
          </div>

          {showBubble && getInsight && (
            <div className="insight-bubble">
              <div className="bubble-header">
                <span 
                  className="bubble-tag" 
                  style={{ background: getInsight.tagColor }}
                >
                  {getInsight.tag}
                </span>
                <span className="bubble-category">
                  {getInsight.data.emoji} {getInsight.data.nameKr}
                </span>
              </div>
              
              <p className="bubble-main">{getInsight.message}</p>
              <p className="bubble-sub">{getInsight.subMessage}</p>
              
              <div className="bubble-stats">
                <div className="stat-row">
                  <span className="stat-label">총 지출</span>
                  <span className="stat-value">₩{getInsight.data.amountKRW.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">건당 평균</span>
                  <span className="stat-value">₩{(getInsight.avgPerItem || 0).toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">도시 평균 대비</span>
                  <span 
                    className={`stat-value trend ${(getInsight.trend || 0) >= 0 ? 'up' : 'down'}`}
                  >
                    {(getInsight.trend || 0) >= 0 ? '+' : ''}{getInsight.trend}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Category Grid */}
        <div className="category-section">
          <div className="section-header">
            <h2>카테고리별 분석</h2>
            <span className="section-desc">탭하여 AI 피드백 확인</span>
          </div>
          
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>분석 중...</p>
            </div>
          ) : (
            <div className="category-grid">
              {categoryData.map((cat, index) => (
                <button
                  key={cat.category}
                  className={`category-item ${selectedCategory === cat.category ? 'selected' : ''}`}
                  onClick={() => handleCategoryClick(cat.category)}
                  style={{ '--delay': `${index * 0.05}s`, '--accent': cat.color } as React.CSSProperties}
                >
                  <div className="item-left">
                    <span className="item-rank">#{index + 1}</span>
                    <span className="item-emoji">{cat.emoji}</span>
                    <div className="item-info">
                      <span className="item-name">{cat.nameKr}</span>
                      <span className="item-count">{cat.count}건</span>
                    </div>
                  </div>
                  <div className="item-right">
                    <span className="item-amount">₩{cat.amountKRW.toLocaleString()}</span>
                    <span className={`item-trend ${(cat.trend || 0) >= 0 ? 'up' : 'down'}`}>
                      {(cat.trend || 0) >= 0 ? '↑' : '↓'} {Math.abs(cat.trend || 0)}%
                    </span>
                  </div>
                  <div className="item-bar">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${(cat.amountKRW / totalSpent) * 100}%` }}
                    ></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI Tips */}
        <div className="tips-section">
          <h3>💡 AI 절약 팁</h3>
          <div className="tips-list">
            <div className="tip-item">
              <span className="tip-icon">🍜</span>
              <div className="tip-content">
                <strong>로컬 맛집 추천</strong>
                <p>관광지 대신 현지인이 가는 식당은 평균 30% 저렴해요</p>
              </div>
            </div>
            <div className="tip-item">
              <span className="tip-icon">🚇</span>
              <div className="tip-content">
                <strong>교통 패스 활용</strong>
                <p>대중교통 1일권으로 교통비를 최대 50% 절약할 수 있어요</p>
              </div>
            </div>
            <div className="tip-item">
              <span className="tip-icon">☕</span>
              <div className="tip-content">
                <strong>편의점 커피</strong>
                <p>카페 대비 평균 70% 저렴한 커피를 즐길 수 있어요</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav activeTab="ai" />
    </div>
  );
}
