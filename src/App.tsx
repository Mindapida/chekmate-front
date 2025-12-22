import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TripProvider } from './context/TripContext';
import { getLastPage } from './components/BottomNav';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import HomePage from './pages/HomePage';
import TripDetailPage from './pages/TripDetailPage';
import ImagesPage from './pages/ImagesPage';
import CalendarPage from './pages/CalendarPage';
import ExpensePage from './pages/ExpensePage';
import PhotoMemoPage from './pages/PhotoMemoPage';
import MyPage from './pages/MyPage';
import { useEffect } from 'react';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'Quicksand, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>✈️</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Public Route - redirect to last visited page if already logged in
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return null;
  }
  
  if (isAuthenticated) {
    // Redirect to last visited page instead of always /home
    const lastPage = getLastPage();
    return <Navigate to={lastPage} replace />;
  }
  
  return <>{children}</>;
}

// Auto-login route for testing - automatically logs in and redirects to home
function AutoLoginRoute() {
  const { login, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const autoLogin = async () => {
      if (!isAuthenticated) {
        const username = searchParams.get('user') || 'testuser';
        await login(username, 'auto-login');
      }
    };
    autoLogin();
  }, [login, isAuthenticated, searchParams]);
  
  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'Quicksand, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔐</div>
        <div>Auto-logging in...</div>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auto-login" element={<AutoLoginRoute />} />
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      <Route path="/signup" element={
        <PublicRoute>
          <SignUpPage />
        </PublicRoute>
      } />
      <Route path="/home" element={
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      } />
      <Route path="/trip/:id" element={
        <ProtectedRoute>
          <TripDetailPage />
        </ProtectedRoute>
      } />
      <Route path="/images" element={
        <ProtectedRoute>
          <ImagesPage />
        </ProtectedRoute>
      } />
      <Route path="/calendar" element={
        <ProtectedRoute>
          <CalendarPage />
        </ProtectedRoute>
      } />
      <Route path="/expense" element={
        <ProtectedRoute>
          <ExpensePage />
        </ProtectedRoute>
      } />
      <Route path="/photo-memo" element={
        <ProtectedRoute>
          <PhotoMemoPage />
        </ProtectedRoute>
      } />
      <Route path="/mypage" element={
        <ProtectedRoute>
          <MyPage />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TripProvider>
          <AppRoutes />
        </TripProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
