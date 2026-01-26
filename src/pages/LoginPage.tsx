import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-login for testing: /login?auto=true&user=testuser
  useEffect(() => {
    const autoLogin = searchParams.get('auto');
    const autoUser = searchParams.get('user') || 'testuser';
    
    if (autoLogin === 'true') {
      console.log('🔑 Auto-login triggered for user:', autoUser);
      login(autoUser, 'password').then(() => {
        navigate('/home');
      }).catch((err) => {
        console.error('Auto-login failed:', err);
      });
    }
  }, [searchParams, login, navigate]);

  const handleBack = () => navigate('/');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await login(username, password);
      navigate('/home');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Map error codes to user-friendly messages
      if (errorMessage === 'SERVER_UNAVAILABLE') {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      } else if (errorMessage === 'INVALID_CREDENTIALS') {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      } else if (errorMessage === 'USER_NOT_FOUND') {
        setError('존재하지 않는 사용자입니다.');
      } else if (errorMessage === 'SERVER_ERROR') {
        setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <header className="login-header">
        <button className="back-button" onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="#2b7fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="header-logo">
          <span className="logo-check">✓</span>
          <span className="logo-text">CHECKMATE</span>
        </div>
      </header>

      <div className="login-container">
        <div className="login-welcome">
          <h1>Welcome Back 👋</h1>
          <p>Login to continue your journey</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input 
              type="text" 
              id="username" 
              placeholder="Enter your username" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password" 
              placeholder="Enter your password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              disabled={isLoading}
            />
          </div>
          <button type="submit" className="btn-login" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
