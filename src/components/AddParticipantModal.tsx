import { useState, useEffect } from 'react';
import { usersApi } from '../api';
import './AddParticipantModal.css';

interface User {
  id: number;
  username: string;
}

interface AddParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (user: User) => void;
  existingParticipantIds: number[];
}

export default function AddParticipantModal({ 
  isOpen, 
  onClose, 
  onAdd, 
  existingParticipantIds,
}: AddParticipantModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setSearchTerm('');
      setFoundUser(null);
      setError('');
      setHasSearched(false);
    }
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setSearchTerm('');
      setFoundUser(null);
      setError('');
      setHasSearched(false);
      onClose();
    }, 300);
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a username');
      return;
    }

    setIsLoading(true);
    setError('');
    setFoundUser(null);
    setHasSearched(true);

    try {
      console.log('🔍 Searching for user:', searchTerm.trim());
      const user = await usersApi.getByUsername(searchTerm.trim());
      console.log('📋 Search result:', user);
      
      if (user) {
        // Check if already added
        if (existingParticipantIds.includes(user.id)) {
          setError('This user is already a participant');
          setFoundUser(null);
        } else {
          setFoundUser(user);
          setError('');
        }
      } else {
        setError(`User "${searchTerm}" not found. Check: 1) Exact username (case-sensitive) 2) User has signed up`);
      }
    } catch (err: unknown) {
      console.error('❌ Search error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Search failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectUser = (user: User) => {
    onAdd(user);
    handleClose();
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

        {/* Search */}
        <div className="search-container">
          <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 19L14.65 14.65" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            type="text"
            placeholder="Enter username to search..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setHasSearched(false);
              setError('');
              setFoundUser(null);
            }}
            onKeyDown={handleKeyPress}
            autoFocus
          />
          <button 
            className="search-btn" 
            onClick={handleSearch}
            disabled={isLoading || !searchTerm.trim()}
          >
            {isLoading ? (
              <div className="search-spinner-small" />
            ) : (
              'Search'
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="search-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="#EF4444" strokeWidth="1.5"/>
              <path d="M8 5V8M8 11H8.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Search Result */}
        <div className="user-list">
          {isLoading ? (
            <div className="loading-users">
              <div className="loading-spinner" />
              <p>Searching...</p>
            </div>
          ) : foundUser ? (
              <button
              className="user-item found"
              onClick={() => handleSelectUser(foundUser)}
              >
                <div className="user-avatar">
                {foundUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <span className="user-name">{foundUser.username}</span>
                <span className="user-hint">Click to add</span>
                </div>
                <svg className="add-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4V16M4 10H16" stroke="#2B7FFF" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
          ) : hasSearched && !error ? (
            <div className="no-users">
              <span>👤</span>
              <p>No user found</p>
              <small>Try a different username</small>
            </div>
          ) : !hasSearched ? (
            <div className="search-prompt">
              <span>🔍</span>
              <p>Search for a user</p>
              <small>Enter their username and click Search</small>
            </div>
          ) : null}
        </div>

        {/* Info */}
        <div className="modal-info">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="#9CA3AF" strokeWidth="1.5"/>
            <path d="M8 5V8M8 11H8.01" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Search for registered users by their exact username</span>
        </div>
      </div>
    </div>
  );
}
