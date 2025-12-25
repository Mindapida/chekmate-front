import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { tripsApi } from '../api';
import type { Trip } from '../types/api';
import { useAuth } from './AuthContext';

interface TripContextType {
  trips: Trip[];
  currentTrip: Trip | null;
  setCurrentTrip: (trip: Trip | null) => void;
  isLoading: boolean;
  error: string | null;
  createTrip: (tripData: { name: string; startDate: string; endDate: string }) => Promise<Trip>;
  deleteTrip: (tripId: number) => Promise<void>;
  refreshTrips: () => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

const CURRENT_TRIP_KEY = 'checkmate_current_trip_id';

export function TripProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentTrip, setCurrentTripState] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set current trip and persist to localStorage
  const setCurrentTrip = useCallback((trip: Trip | null) => {
    setCurrentTripState(trip);
    if (trip) {
      localStorage.setItem(CURRENT_TRIP_KEY, String(trip.id));
    } else {
      localStorage.removeItem(CURRENT_TRIP_KEY);
    }
  }, []);

  // Fetch all trips
  const fetchTrips = useCallback(async () => {
    if (!isAuthenticated) {
      setTrips([]);
      setCurrentTripState(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const fetchedTrips = await tripsApi.getAll();
      setTrips(fetchedTrips);
      
      // Restore current trip from localStorage
      const savedTripId = localStorage.getItem(CURRENT_TRIP_KEY);
      if (savedTripId) {
        const savedTrip = fetchedTrips.find(t => t.id === Number(savedTripId));
        if (savedTrip) {
          setCurrentTripState(savedTrip);
        } else if (fetchedTrips.length > 0) {
          // If saved trip not found, select first trip
          setCurrentTrip(fetchedTrips[0]);
        }
      } else if (fetchedTrips.length > 0) {
        // If no saved trip, auto-select first trip
        setCurrentTrip(fetchedTrips[0]);
      }
    } catch (err) {
      console.error('Failed to fetch trips:', err);
      setError('Failed to load trips');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, setCurrentTrip]);

  // Create a new trip
  const createTrip = useCallback(async (tripData: { name: string; startDate: string; endDate: string }): Promise<Trip> => {
    setError(null);
    
    try {
      const newTrip = await tripsApi.create({
        name: tripData.name,
        start_date: tripData.startDate,
        end_date: tripData.endDate,
      });
      
      setTrips(prev => [...prev, newTrip]);
      return newTrip;
    } catch (err) {
      console.error('Failed to create trip:', err);
      setError('Failed to create trip');
      throw err;
    }
  }, []);

  // Delete a trip
  const deleteTrip = useCallback(async (tripId: number): Promise<void> => {
    setError(null);
    
    try {
      await tripsApi.delete(tripId);
      setTrips(prev => prev.filter(t => t.id !== tripId));
      
      // If deleted trip was current, clear or select another
      if (currentTrip?.id === tripId) {
        const remaining = trips.filter(t => t.id !== tripId);
        setCurrentTrip(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err) {
      console.error('Failed to delete trip:', err);
      setError('Failed to delete trip');
      throw err;
    }
  }, [currentTrip, trips, setCurrentTrip]);

  // Refresh trips
  const refreshTrips = useCallback(async () => {
    await fetchTrips();
  }, [fetchTrips]);

  // Fetch trips when authenticated
  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // Clear state on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setTrips([]);
      setCurrentTripState(null);
      localStorage.removeItem(CURRENT_TRIP_KEY);
    }
  }, [isAuthenticated]);

  return (
    <TripContext.Provider
      value={{
        trips,
        currentTrip,
        setCurrentTrip,
        isLoading,
        error,
        createTrip,
        deleteTrip,
        refreshTrips,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrips(): TripContextType {
  const context = useContext(TripContext);
  if (context === undefined) {
    throw new Error('useTrips must be used within a TripProvider');
  }
  return context;
}
