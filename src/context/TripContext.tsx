import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { tripsApi } from '../api';
import { useAuth } from './AuthContext';
import type { Trip } from '../types/api';

interface TripContextType {
  trips: Trip[];
  currentTrip: Trip | null;
  isLoading: boolean;
  createTrip: (data: { name: string; startDate: string; endDate: string }) => Promise<Trip>;
  deleteTrip: (id: number) => Promise<void>;
  setCurrentTrip: (trip: Trip | null) => void;
  refreshTrips: () => Promise<void>;
}

const TripContext = createContext<TripContextType | null>(null);

const TRIPS_STORAGE_KEY = 'checkmate_trips';
const CURRENT_TRIP_KEY = 'checkmate_current_trip';

export function TripProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentTrip, setCurrentTripState] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load trips and current trip when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadTrips();
      loadCurrentTrip();
    } else {
      setTrips([]);
      setCurrentTripState(null);
    }
  }, [isAuthenticated, user]);

  // Update currentTrip if trips change (e.g., trip deleted)
  useEffect(() => {
    if (currentTrip && !trips.find(t => t.id === currentTrip.id)) {
      // Current trip no longer exists, clear it
      setCurrentTripState(null);
      if (user?.id) {
        localStorage.removeItem(`${CURRENT_TRIP_KEY}_${user.id}`);
      }
    }
  }, [trips, currentTrip, user]);

  const loadCurrentTrip = () => {
    if (!user?.id) return;
    const stored = localStorage.getItem(`${CURRENT_TRIP_KEY}_${user.id}`);
    if (stored) {
      setCurrentTripState(JSON.parse(stored));
    }
  };

  const setCurrentTrip = (trip: Trip | null) => {
    setCurrentTripState(trip);
    if (user?.id) {
      if (trip) {
        localStorage.setItem(`${CURRENT_TRIP_KEY}_${user.id}`, JSON.stringify(trip));
      } else {
        localStorage.removeItem(`${CURRENT_TRIP_KEY}_${user.id}`);
      }
    }
  };

  const loadTrips = async () => {
    setIsLoading(true);
    try {
      const data = await tripsApi.getAll();
      setTrips(data);
      // Sync to localStorage
      saveToLocalStorage(data, user?.id);
    } catch (error) {
      console.warn('Backend not available, loading from localStorage');
      const localTrips = loadFromLocalStorage(user?.id);
      setTrips(localTrips);
    }
    setIsLoading(false);
  };

  const saveToLocalStorage = (data: Trip[], userId?: number) => {
    if (!userId) return;
    const allTrips = JSON.parse(localStorage.getItem(TRIPS_STORAGE_KEY) || '{}');
    allTrips[userId] = data;
    localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(allTrips));
  };

  const loadFromLocalStorage = (userId?: number): Trip[] => {
    if (!userId) return [];
    const allTrips = JSON.parse(localStorage.getItem(TRIPS_STORAGE_KEY) || '{}');
    return allTrips[userId] || [];
  };

  const createTrip = async (data: { name: string; startDate: string; endDate: string }): Promise<Trip> => {
    try {
      const newTrip = await tripsApi.create({
        name: data.name,
        start_date: data.startDate,
        end_date: data.endDate,
      });
      const updatedTrips = [...trips, newTrip];
      setTrips(updatedTrips);
      saveToLocalStorage(updatedTrips, user?.id);
      return newTrip;
    } catch (error) {
      console.warn('Backend not available, saving to localStorage');
      // Fallback: create locally
      const newTrip: Trip = {
        id: Date.now(),
        name: data.name,
        start_date: data.startDate,
        end_date: data.endDate,
        created_by: user?.id || 0,
        created_at: new Date().toISOString(),
      };
      const updatedTrips = [...trips, newTrip];
      setTrips(updatedTrips);
      saveToLocalStorage(updatedTrips, user?.id);
      return newTrip;
    }
  };

  const deleteTrip = async (id: number) => {
    try {
      await tripsApi.delete(id);
    } catch (error) {
      console.warn('Backend not available, deleting locally');
    }
    const updatedTrips = trips.filter(t => t.id !== id);
    setTrips(updatedTrips);
    saveToLocalStorage(updatedTrips, user?.id);
  };

  const refreshTrips = async () => {
    await loadTrips();
  };

  return (
    <TripContext.Provider value={{
      trips,
      currentTrip,
      isLoading,
      createTrip,
      deleteTrip,
      setCurrentTrip,
      refreshTrips,
    }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTrips() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTrips must be used within a TripProvider');
  }
  return context;
}

