import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SignUpPage.css';

// Password validation: at least 10 characters, must contain both letters and numbers
const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 10) {
    return { valid: false, message: 'Password must be at least 10 characters' };
  }
  
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  if (!hasLetter) {
    return { valid: false, message: 'Password must contain at least one letter' };
  }
  
  if (!hasNumber) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  return { valid: true, message: '' };
};

// Username validation
const validateUsername = (username: string): { valid: boolean; message: string } => {
  if (username.length < 3) {
    return { valid: false, message: 'Username must be at least 3 characters' };
  }
  
  if (username.length > 20) {
    return { valid: false, message: 'Username must be less than 20 characters' };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: 'Username can only contain letters, numbers, and underscores' };
  }
  
  return { valid: true, message: '' };
};

export default function SignUpPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Validation states
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Validate username format when it changes
  useEffect(() => {
    if (username) {
      const validation = validateUsername(username);
      setUsernameError(validation.valid ? '' : validation.message);
    } else {
      setUsernameError('');
    }
  }, [username]);

  // Validate password when it changes
  useEffect(() => {
    if (password) {
      const validation = validatePassword(password);
      setPasswordError(validation.valid ? '' : validation.message);
    } else {
      setPasswordError('');
    }
  }, [password]);

  const handleBack = () => navigate('/');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setError('');
    
    // Check all fields filled
    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    
    // Validate username format
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      setError(usernameValidation.message);
      setUsernameError(usernameValidation.message);
      return;
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      setPasswordError(passwordValidation.message);
      return;
    }
    
    // Check passwords match
    if (password !== confirmPassword) { 
      setError('Passwords do not match!'); 
      return; 
    }
    
    setIsLoading(true);
    
    try {
      await register(username, email, password);
      navigate('/home');
    } catch (err) {
      console.error('Registration error:', err);
      
      if (err instanceof Error) {
        switch (err.message) {
          case 'USERNAME_EXISTS':
            setError('This username is already taken. Please choose a different username.');
            setUsernameError('Username is already taken');
            break;
          case 'EMAIL_EXISTS':
            setError('This email is already registered. Please use a different email or login.');
            break;
          case 'REGISTER_FAILED':
          default:
            setError('Registration failed. Please try again later.');
            break;
        }
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate password strength
  const getPasswordStrength = () => {
    if (!password) return null;
    
    let strength = 0;
    if (password.length >= 10) strength++;
    if (password.length >= 14) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    if (strength <= 2) return { level: 'weak', color: '#ef4444', text: 'Weak' };
    if (strength <= 3) return { level: 'medium', color: '#f59e0b', text: 'Medium' };
    return { level: 'strong', color: '#22c55e', text: 'Strong' };
  };

  const passwordStrength = getPasswordStrength();
  
  // Check if password confirmation matches
  const passwordsMatch = confirmPassword && password === confirmPassword;
  const passwordsMismatch = confirmPassword && password !== confirmPassword;

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
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input 
              type="text" 
              id="username" 
              placeholder="Choose a username" 
              value={username} 
              onChange={(e) => {
                setUsername(e.target.value);
                setError(''); // Clear error when user types
              }} 
              disabled={isLoading}
              className={usernameError ? 'error' : username && !usernameError ? 'valid' : ''}
              required 
            />
            {usernameError && <span className="field-error">{usernameError}</span>}
            <span className="field-hint">3-20 characters, letters, numbers, underscores only</span>
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input 
              type="email" 
              id="email" 
              placeholder="Enter your email" 
              value={email} 
              onChange={(e) => {
                setEmail(e.target.value);
                setError(''); // Clear error when user types
              }} 
              disabled={isLoading}
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password" 
              placeholder="Create a password" 
              value={password} 
              onChange={(e) => {
                setPassword(e.target.value);
                setError(''); // Clear error when user types
              }} 
              disabled={isLoading}
              className={passwordError ? 'error' : password && !passwordError ? 'valid' : ''}
              required 
            />
            {passwordError && <span className="field-error">{passwordError}</span>}
            <span className="field-hint">At least 10 characters with letters and numbers</span>
            {password && passwordStrength && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div 
                    className={`strength-fill ${passwordStrength.level}`}
                    style={{ backgroundColor: passwordStrength.color }}
                  />
                </div>
                <span className="strength-text" style={{ color: passwordStrength.color }}>
                  {passwordStrength.text}
                </span>
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input 
              type="password" 
              id="confirmPassword" 
              placeholder="Confirm your password" 
              value={confirmPassword} 
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(''); // Clear error when user types
              }} 
              disabled={isLoading}
              className={passwordsMismatch ? 'error' : passwordsMatch ? 'valid' : ''}
              required 
            />
            {passwordsMismatch && (
              <span className="field-error">Passwords do not match</span>
            )}
            {passwordsMatch && (
              <span className="field-success">✓ Passwords match</span>
            )}
          </div>
          
          <button 
            type="submit" 
            className="btn-signup" 
            disabled={isLoading || !!usernameError || !!passwordError}
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        <p className="login-link">Already have an account? <span onClick={() => navigate('/login')}>Login</span></p>
      </div>
    </div>
  );
}
