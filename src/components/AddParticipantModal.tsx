import { useState, useEffect } from 'react';
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
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      loadRegisteredUsers();
    }
  }, [isOpen]);

  const loadRegisteredUsers = () => {
    // Load registered users from localStorage
    // In production, this would be an API call
    const stored = localStorage.getItem('registered_users');
    if (stored) {
      setRegisteredUsers(JSON.parse(stored));
    } else {
      // Initialize with current user if no users exist
      const mockUser = localStorage.getItem('mock_user');
      if (mockUser) {
        const user = JSON.parse(mockUser);
        const users = [{ id: user.id, username: user.username }];
        localStorage.setItem('registered_users', JSON.stringify(users));
        setRegisteredUsers(users);
      }
    }
  };

  // Also add current user to registered users when they sign up
  useEffect(() => {
    const mockUser = localStorage.getItem('mock_user');
    if (mockUser) {
      const user = JSON.parse(mockUser);
      const stored = localStorage.getItem('registered_users');
      const users: User[] = stored ? JSON.parse(stored) : [];
      
      if (!users.some(u => u.id === user.id)) {
        users.push({ id: user.id, username: user.username });
        localStorage.setItem('registered_users', JSON.stringify(users));
      }
    }
  }, []);

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

  const filteredUsers = registeredUsers.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) &&
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
            placeholder="Search registered users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        {/* User List */}
        <div className="user-list">
          {filteredUsers.length === 0 ? (
            <div className="no-users">
              <span>👤</span>
              <p>No users found</p>
              <small>Only registered users can be added</small>
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
          <span>Only users who have signed up can be added as participants</span>
        </div>
      </div>
    </div>
  );
}

