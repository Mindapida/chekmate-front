import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignUpPage.css';

export default function SignUpPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleBack = () => navigate('/');

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { alert('Passwords do not match!'); return; }
    console.log('Sign Up:', { username, password });
    navigate('/login');
  };

  return (
    <div className="signup-page">
      <header className="signup-header">
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

      <div className="signup-container">
        <div className="signup-welcome">
          <h1>Create Account ✈️</h1>
          <p>Join us to track your travel expenses</p>
        </div>

        <form className="signup-form" onSubmit={handleSignUp}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input type="text" id="username" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input type="password" id="confirmPassword" placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-signup">Sign Up</button>
        </form>
        <p className="login-link">Already have an account? <span onClick={() => navigate('/login')}>Login</span></p>
      </div>
    </div>
  );
}

