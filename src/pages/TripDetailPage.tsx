import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import AddParticipantModal from '../components/AddParticipantModal';
import './TripDetailPage.css';

interface Participant {
  id: number;
  name: string;
  username: string;
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { trips } = useTrips();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const trip = trips.find(t => t.id === Number(id));

  useEffect(() => {
    if (trip) {
      // Load participants from localStorage
      const stored = localStorage.getItem(`trip_participants_${trip.id}`);
      if (stored) {
        setParticipants(JSON.parse(stored));
      }
    }
  }, [trip]);

  if (!trip) {
    return (
      <div className="trip-detail-page">
        <div className="not-found">
          <span>😕</span>
          <h2>Trip not found</h2>
          <button onClick={() => navigate('/home')}>Go Home</button>
        </div>
      </div>
    );
  }

  const handleClose = () => {
    navigate('/home');
  };

  const handleAddParticipant = (user: { id: number; username: string }) => {
    const newParticipant: Participant = {
      id: user.id,
      name: user.username,
      username: user.username,
    };
    
    // Check if already added
    if (participants.some(p => p.id === user.id)) {
      return;
    }
    
    const updated = [...participants, newParticipant];
    setParticipants(updated);
    localStorage.setItem(`trip_participants_${trip.id}`, JSON.stringify(updated));
  };

  const handleRemoveParticipant = (participantId: number) => {
    const updated = participants.filter(p => p.id !== participantId);
    setParticipants(updated);
    localStorage.setItem(`trip_participants_${trip.id}`, JSON.stringify(updated));
  };

  const formatDate = (dateStr: string) => {
    return dateStr;
  };

  return (
    <div className="trip-detail-page">
      {/* Header */}
      <div className="detail-header">
        <div className="header-info">
          <h1 className="trip-title">{trip.name}</h1>
          <p className="trip-dates">{formatDate(trip.start_date)} to {formatDate(trip.end_date)}</p>
        </div>
        <button className="close-btn" onClick={handleClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="detail-content">
        {/* Participants Section */}
        <div className="section">
          <div className="section-header">
            <h2>Participants</h2>
            <button className="add-participant-btn" onClick={() => setIsModalOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add Participant
            </button>
          </div>

          {participants.length === 0 ? (
            <p className="empty-text">No participants yet</p>
          ) : (
            <div className="participants-list">
              {participants.map(participant => (
                <div key={participant.id} className="participant-chip">
                  <span className="participant-name">{participant.name}</span>
                  <button 
                    className="remove-btn"
                    onClick={() => handleRemoveParticipant(participant.id)}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settlement Section */}
        <div className="section">
          <h2>Settlement</h2>
          <div className="settlement-card">
            <p>Settlement will be available after trip end date</p>
            <button className="settle-btn" disabled>Settle Up</button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{participants.length}</span>
            <span className="stat-label">Participants</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">0</span>
            <span className="stat-label">Expenses</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">0</span>
            <span className="stat-label">Photos</span>
          </div>
        </div>
      </div>

      <AddParticipantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddParticipant}
        existingParticipants={participants.map(p => p.id)}
      />
    </div>
  );
}















