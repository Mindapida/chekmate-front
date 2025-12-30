import { useState, useEffect } from 'react';
import './AddParticipantModal.css';

interface AddParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (username: string) => Promise<void>;
}

export default function AddParticipantModal({ 
  isOpen, 
  onClose, 
  onAdd,
}: AddParticipantModalProps) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setUsername('');
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setUsername('');
      setError('');
      setSuccess('');
      onClose();
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedUsername = username.trim();
    
    if (!trimmedUsername) {
      setError('Please enter a username');
      return;
    }

    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await onAdd(trimmedUsername);
      setSuccess(`${trimmedUsername} has been added!`);
      setUsername('');
      
      // Close modal after short delay
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to add participant:', err);
      if (err instanceof Error) {
        if (err.message.includes('404') || err.message.includes('not found')) {
          setError(`User "${trimmedUsername}" not found. Make sure the username is correct.`);
        } else if (err.message.includes('already') || err.message.includes('exists')) {
          setError(`${trimmedUsername} is already a participant.`);
        } else {
          setError(err.message || 'Failed to add participant. Please try again.');
        }
      } else {
        setError('Failed to add participant. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`participant-modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`participant-modal ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="participant-modal-header">
          <h2>Add Participant</h2>
          <button className="close-btn" onClick={handleClose} type="button">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="participant-form">
          {/* Username Input */}
          <div className="input-container">
            <label htmlFor="username-input">Username</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 10C12.2091 10 14 8.20914 14 6C14 3.79086 12.2091 2 10 2C7.79086 2 6 3.79086 6 6C6 8.20914 7.79086 10 10 10Z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17.0001 18C17.0001 14.6863 13.866 12 10.0001 12C6.13413 12 3.00006 14.6863 3.00006 18" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                id="username-input"
                type="text"
                placeholder="Enter username to add"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setError('');
                  setSuccess('');
                }}
                disabled={isLoading}
                autoFocus
                autoComplete="off"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="message error-message">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="#EF4444" strokeWidth="1.5"/>
                <path d="M8 5V8M8 11H8.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="message success-message">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="#22C55E" strokeWidth="1.5"/>
                <path d="M5.5 8L7 9.5L10.5 6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            className="submit-btn"
            disabled={isLoading || !username.trim()}
          >
            {isLoading ? (
              <>
                <span className="btn-spinner" />
                Adding...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Add Participant
              </>
            )}
          </button>
        </form>

        {/* Info */}
        <div className="modal-info">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="#9CA3AF" strokeWidth="1.5"/>
            <path d="M8 5V8M8 11H8.01" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Enter the exact username of a registered user to add them</span>
        </div>
      </div>
    </div>
  );
}
