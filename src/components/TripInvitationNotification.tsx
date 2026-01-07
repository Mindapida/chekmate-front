import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { invitationsApi } from '../api';
import type { Trip } from '../types/api';
import './TripInvitationNotification.css';

// Key for storing accepted trip IDs per user
const getAcceptedTripsKey = (userId: number) => `accepted_trips_${userId}`;

interface TripInvitationNotificationProps {
  onTripsUpdated?: () => void;
}

export default function TripInvitationNotification({ onTripsUpdated }: TripInvitationNotificationProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  // Get accepted trip IDs for current user
  const getAcceptedTripIds = useCallback((): number[] => {
    if (!user) return [];
    const key = getAcceptedTripsKey(user.id);
    return JSON.parse(localStorage.getItem(key) || '[]');
  }, [user]);

  // Mark trip as accepted for current user
  const markTripAsAccepted = useCallback((tripId: number) => {
    if (!user) return;
    const key = getAcceptedTripsKey(user.id);
    const acceptedIds = JSON.parse(localStorage.getItem(key) || '[]') as number[];
    if (!acceptedIds.includes(tripId)) {
      acceptedIds.push(tripId);
      localStorage.setItem(key, JSON.stringify(acceptedIds));
      console.log('✅ Trip marked as accepted:', tripId);
    }
  }, [user]);

  // Load new invitations (only trips where user is NOT the creator AND hasn't accepted yet)
  const loadInvitations = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const newTrips = await invitationsApi.getNewInvitations();
      const acceptedTripIds = getAcceptedTripIds();
      
      // Filter out:
      // 1. Trips created by the current user
      // 2. Trips already accepted by the current user
      const invitedTrips = newTrips.filter(trip => 
        trip.created_by !== user.id && !acceptedTripIds.includes(trip.id)
      );
      console.log('🔔 New invitations for', user.username, ':', invitedTrips.length, 
        '(filtered from', newTrips.length, 'new trips, accepted:', acceptedTripIds.length, ')');
      setInvitations(invitedTrips);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, getAcceptedTripIds]);

  useEffect(() => {
    loadInvitations();
    
    // Poll for new invitations every 30 seconds
    const interval = setInterval(loadInvitations, 30000);
    return () => clearInterval(interval);
  }, [loadInvitations]);

  // Accept invitation (mark as accepted and navigate to trip)
  const handleAccept = async (trip: Trip) => {
    // Mark as accepted (permanent - won't show again)
    markTripAsAccepted(trip.id);
    invitationsApi.markAsSeen(trip.id);
    setInvitations(prev => prev.filter(t => t.id !== trip.id));
    onTripsUpdated?.();
    navigate(`/trip/${trip.id}`);
  };

  // Decline/dismiss invitation (just hide, can reappear if localStorage clears)
  const handleDecline = async (trip: Trip) => {
    // Mark as accepted so it won't show again
    markTripAsAccepted(trip.id);
    invitationsApi.markAsSeen(trip.id);
    setInvitations(prev => prev.filter(t => t.id !== trip.id));
  };

  // Dismiss all
  const handleDismissAll = () => {
    // Mark all as accepted
    invitations.forEach(trip => markTripAsAccepted(trip.id));
    const tripIds = invitations.map(t => t.id);
    invitationsApi.markAllAsSeen(tripIds);
    setInvitations([]);
  };

  if (isLoading || invitations.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`invitation-notification ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="notification-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="notification-icon">
          <span className="bell">🔔</span>
          <span className="badge">{invitations.length}</span>
        </div>
        <div className="notification-title">
          <h3>Trip Invitations</h3>
          <p>{invitations.length} new invitation{invitations.length > 1 ? 's' : ''}</p>
        </div>
        <button className="toggle-btn">
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 20 20" 
            fill="none"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}
          >
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="invitation-list">
          {invitations.map(trip => (
            <div key={trip.id} className="invitation-item">
              <div className="trip-info">
                <div className="trip-icon">✈️</div>
                <div className="trip-details">
                  <h4>{trip.name}</h4>
                  <p className="trip-dates">
                    {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
                  </p>
                  <p className="invite-message">You've been invited to join this trip!</p>
                </div>
              </div>
              <div className="invitation-actions">
                <button className="accept-btn" onClick={() => handleAccept(trip)}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Accept
                </button>
                <button className="decline-btn" onClick={() => handleDecline(trip)}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
          
          {invitations.length > 1 && (
            <button className="dismiss-all-btn" onClick={handleDismissAll}>
              Dismiss All
            </button>
          )}
        </div>
      )}
    </div>
  );
}

