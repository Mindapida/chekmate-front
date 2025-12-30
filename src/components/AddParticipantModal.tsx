import { useState, useEffect, useCallback } from 'react';
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
  existingParticipants: number[];
}

export default function AddParticipantModal({ 
  isOpen, 
  onClose, 
  onAdd, 
  existingParticipants 
}: AddParticipantModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState('');

  // Load all users when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setSearchTerm('');
      setError('');
      loadAllUsers();
    }
  }, [isOpen]);

  const loadAllUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const allUsers = await usersApi.getAll();
      setUsers(allUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      loadAllUsers();
      return;
    }
    
    setIsLoading(true);
    setError('');
    try {
      const results = await usersApi.search(query);
      setUsers(results);
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchUsers(searchTerm);
      } else if (isOpen) {
        loadAllUsers();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchUsers, isOpen]);

  if (!isOpen && !isClosing) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setSearchTerm('');
      onClose();
    }, 300);
  };

  const handleSelect = (user: User) => {
    onAdd(user);
    handleClose();
  };

  // Filter out existing participants
  const filteredUsers = users.filter(user => 
    !existingParticipants.includes(user.id)
  );

  return (
    <div className={`participant-modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`participant-modal ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="participant-modal-header">
          <h2>Add Participant</h2>
          <button className="close-btn" onClick={handleClose}>
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
            placeholder="Search by username..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            autoFocus
          />
          {isLoading && <div className="search-spinner" />}
        </div>

        {/* Error Message */}
        {error && (
          <div className="search-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="#EF4444" strokeWidth="1.5"/>
              <path d="M8 5V8M8 11H8.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>{error}</span>
            <button onClick={loadAllUsers} className="retry-btn">Retry</button>
          </div>
        )}

        {/* User List */}
        <div className="user-list">
          {isLoading && users.length === 0 ? (
            <div className="loading-users">
              <div className="loading-spinner" />
              <p>Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="no-users">
              <span>👤</span>
              <p>{searchTerm ? 'No users found' : 'No available users'}</p>
              <small>{searchTerm ? 'Try a different search term' : 'All registered users are already participants'}</small>
            </div>
          ) : (
            filteredUsers.map(user => (
              <button
                key={user.id}
                className="user-item"
                onClick={() => handleSelect(user)}
              >
                <div className="user-avatar">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="user-name">{user.username}</span>
                <svg className="add-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4V16M4 10H16" stroke="#2B7FFF" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            ))
          )}
        </div>

        {/* Info */}
        <div className="modal-info">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="#9CA3AF" strokeWidth="1.5"/>
            <path d="M8 5V8M8 11H8.01" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Search and add registered users as trip participants</span>
        </div>
      </div>
    </div>
  );
}
