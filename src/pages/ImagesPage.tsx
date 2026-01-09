import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { diaryApi, expensesApi, commentsApi, tripsApi } from '../api';
import PhotoImage from '../components/PhotoImage';
import BottomNav, { saveLastPage } from '../components/BottomNav';
import './ImagesPage.css';
import '../components/PhotoImage.css';

// Types for diary photos from API
interface DiaryPhoto {
  id: number;
  file_path: string;
  file_name: string;
  memo: string | null;
  order_index: number;
  created_at: string;
}

interface DiaryEntry {
  id: number;
  trip_id: number;
  user_id: number;
  username: string;
  date: string;
  expense_id: number | null;
  memo: string | null;
  photos: DiaryPhoto[];
  created_at: string;
  updated_at: string;
}

interface PhotoEntry {
  id: string;
  photoId: number;
  type: 'expense' | 'dump';
  filePath: string;
  fileName: string;
  date: string;
  author: string;
  expenseId?: number;
  expenseInfo?: {
    place: string;
    amount: number;
    currency: string;
    category: string;
    time: string;
  };
  memo?: string;
}

interface Comment {
  id: string;
  photoId: number;
  text: string;
  author: string;
  userId: number;
  timestamp: string;
}

interface CommentData {
  [photoId: string]: Comment[];
}

export default function ImagesPage() {
  const navigate = useNavigate();
  const { currentTrip } = useTrips();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [memos, setMemos] = useState<{ [date: string]: string }>({});
  const [comments, setComments] = useState<CommentData>({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('timeline');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<{ id: number; username: string }[]>([]);
  
  // Swipe handling
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  
  // Get current selected photo
  const selectedPhoto = selectedPhotoIndex !== null ? photos[selectedPhotoIndex] : null;

  // Save current page on mount
  useEffect(() => {
    saveLastPage('/images');
  }, []);

  // Load participants for the trip
  const loadParticipants = useCallback(async () => {
    if (!currentTrip) return;
    
    try {
      const parts = await tripsApi.getParticipants(currentTrip.id);
      console.log('👥 [Images] Trip participants:', parts);
      setParticipants(parts.map(p => ({ id: p.id, username: p.username || p.name })));
    } catch (error) {
      console.error('Failed to load participants:', error);
    }
  }, [currentTrip]);

  // Load photos from backend
  const loadPhotos = useCallback(async () => {
    if (!currentTrip) return;
    
    setLoading(true);
    console.log('📸 [Images] Loading photos for trip:', currentTrip.id, currentTrip.name);
    console.log('👤 [Images] Current user:', user?.username, user?.id);
    
    try {
      const allPhotos: PhotoEntry[] = [];
      const allMemos: { [date: string]: string } = {};
      
      // Get trip date range
      const startDate = new Date(currentTrip.start_date);
      const endDate = new Date(currentTrip.end_date);
      
      // Load diary entries for each date in the trip
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        try {
          // Get diary entries for this date (includes all participants' photos!)
          const entries = await diaryApi.getEntriesForDate(currentTrip.id, dateStr);
          
          // Debug: Log entries to see who's data we're getting
          if (entries.length > 0) {
            console.log(`📸 [Images][${dateStr}] Diary entries:`, entries.map(e => ({
              id: e.id,
              user_id: e.user_id,
              username: e.username,
              photoCount: e.photos.length
            })));
          }
          
          // Get expenses for this date (for expense info)
          let expenses: any[] = [];
          try {
            expenses = await expensesApi.getByDate(currentTrip.id, dateStr);
          } catch (e) {
            // Expenses might not exist for this date
          }
          
          entries.forEach((entry: DiaryEntry) => {
            // Store daily memo
            if (!entry.expense_id && entry.memo) {
              allMemos[dateStr] = entry.memo;
            }
            
            // Add photos
            entry.photos.forEach((photo: DiaryPhoto) => {
              const photoEntry: PhotoEntry = {
                id: `${entry.expense_id ? 'expense' : 'dump'}_${dateStr}_${photo.id}`,
                photoId: photo.id,
                type: entry.expense_id ? 'expense' : 'dump',
                filePath: photo.file_path,
                fileName: photo.file_name,
                date: dateStr,
                author: entry.username,
                memo: entry.memo || undefined,
              };
              
              // If expense-linked, add expense info
              if (entry.expense_id) {
                photoEntry.expenseId = entry.expense_id;
                const expense = expenses.find((e: any) => e.id === entry.expense_id);
                if (expense) {
                  photoEntry.expenseInfo = {
                    place: expense.place || expense.description || 'No place',
                    amount: expense.amount,
                    currency: expense.currency,
                    category: expense.category || 'other',
                    time: expense.time || '--:--'
                  };
                }
              }
              
              allPhotos.push(photoEntry);
            });
          });
        } catch (error) {
          // No entries for this date
        }
      }
      
      // Sort by date (newest first)
      allPhotos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPhotos(allPhotos);
      setMemos(allMemos);
      
      // Summary log
      const uniqueAuthors = [...new Set(allPhotos.map(p => p.author))];
      console.log('📸 [Images] Photos loaded:', {
        totalPhotos: allPhotos.length,
        photoAuthors: uniqueAuthors,
        myPhotos: allPhotos.filter(p => p.author === user?.username).length,
        sharedPhotos: allPhotos.filter(p => p.author !== user?.username).length,
      });
      
      // Load comments from backend (shared among all participants!)
      try {
        const sharedComments = await commentsApi.getComments(currentTrip.id);
        setComments(sharedComments);
        console.log('💬 Loaded shared comments');
      } catch (error) {
        console.error('Failed to load comments:', error);
      }
      
    } catch (error) {
      console.error('Failed to load photos:', error);
    } finally {
      setLoading(false);
    }
  }, [currentTrip, user]);

  useEffect(() => {
    loadPhotos();
    loadParticipants();
  }, [loadPhotos, loadParticipants]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getCategoryEmoji = (category: string) => {
    const categories: { [key: string]: string } = {
      'food': '🍽️', 'drinks': '🍺', 'transport': '🚗', 'hotel': '🏨',
      'shopping': '🛍️', 'activity': '🎭', 'ticket': '🎫', 'gift': '🎁', 'cafe': '☕',
      'transportation': '🚗', 'accommodation': '🏨', 'entertainment': '🎭',
      'souvenir': '🎁', 'drink': '🍺', 'health': '💊', 'communication': '📱', 'other': '📝'
    };
    return categories[category?.toLowerCase()] || '📸';
  };

  // Add a new comment to a photo (saved to backend, shared with all participants)
  const [addingComment, setAddingComment] = useState(false);
  
  const handleAddComment = async () => {
    if (!selectedPhoto || !newComment.trim() || !currentTrip || !user || addingComment) return;

    setAddingComment(true);
    try {
      // Add comment via API (shared with all participants!)
      const newCommentObj = await commentsApi.addComment(
        currentTrip.id,
        selectedPhoto.photoId,
        newComment.trim(),
        user.username,
        user.id
      );

      // Update local state
      const photoKey = String(selectedPhoto.photoId);
      const photoComments = comments[photoKey] || [];
      const updatedComments = {
        ...comments,
        [photoKey]: [...photoComments, newCommentObj],
      };

      setComments(updatedComments);
      setNewComment('');
      console.log('✅ Comment added and shared');
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setAddingComment(false);
    }
  };

  // Format timestamp for comments
  const formatCommentTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Photo navigation
  const goToPrevPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
      setNewComment('');
    }
  };

  const goToNextPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1);
      setNewComment('');
    }
  };

  // Open photo at specific index
  const openPhoto = (photo: PhotoEntry) => {
    const index = photos.findIndex(p => p.id === photo.id);
    setSelectedPhotoIndex(index >= 0 ? index : null);
  };

  // Close photo modal
  const closePhotoModal = () => {
    setSelectedPhotoIndex(null);
    setNewComment('');
  };

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (swipeDistance > minSwipeDistance) {
      // Swiped left - go to next
      goToNextPhoto();
    } else if (swipeDistance < -minSwipeDistance) {
      // Swiped right - go to prev
      goToPrevPhoto();
    }
  };

  // Group photos by date
  const groupedPhotos = photos.reduce((acc, photo) => {
    if (!acc[photo.date]) acc[photo.date] = [];
    acc[photo.date].push(photo);
    return acc;
  }, {} as { [date: string]: PhotoEntry[] });

  const uniqueDates = Object.keys(groupedPhotos).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (!currentTrip) {
    return (
      <div className="images-page">
        <div className="no-trip-message">
          <span>📸</span>
          <h2>No trip selected</h2>
          <p>Please select a current trip first</p>
          <button onClick={() => navigate('/home')}>Go to Home</button>
        </div>
        <BottomNav activeTab="images" />
      </div>
    );
  }

  return (
    <div className="images-page">
      <div className="page-content">
        {/* Header */}
        <header className="page-header">
          <div className="header-logo">
            <span className="logo-check">✓</span>
            <span className="logo-text">CHECKMATE</span>
          </div>
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
            >📅</button>
            <button 
              className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >▦</button>
          </div>
        </header>


        {/* Trip Info */}
        <div className="trip-info-bar">
          <div className="trip-name-display">
            <span>📸</span>
            <span>IMAGE FEED</span>
            <span className="shared-indicator">👥 Shared</span>
          </div>
          <span className="trip-dates-small">
            {currentTrip.name} • {photos.length} photos
          </span>
        </div>

        {/* Photos Container */}
        {loading ? (
          <div className="loading-photos">
            <div className="loading-spinner">📷</div>
            <p>Loading shared photos...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="empty-images">
            <div className="empty-icon">📷</div>
            <h3>No photos yet</h3>
            <p>Add photos from the Calendar → Photo</p>
            <p className="shared-hint">All participants can see each other's photos!</p>
            <button className="go-calendar-btn" onClick={() => navigate('/calendar')}>
              Go to Calendar
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid-view">
            {photos.map((photo) => {
              const isMyPhoto = photo.author === user?.username;
              return (
                <div 
                  key={photo.id} 
                  className={`grid-photo ${!isMyPhoto ? 'shared-photo' : ''}`}
                  onClick={() => openPhoto(photo)}
                >
                  <PhotoImage
                    photoId={photo.photoId}
                    filePath={photo.filePath}
                    fileName={photo.fileName}
                    className="grid-photo-img"
                  />
                  {photo.type === 'expense' && (
                    <span className="photo-type-badge expense">💰</span>
                  )}
                  {!isMyPhoto && (
                    <span className="photo-shared-indicator">👥</span>
                  )}
                  <span className={`photo-author-badge ${!isMyPhoto ? 'other-author' : ''}`}>
                    {isMyPhoto ? 'Me' : photo.author}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="timeline-view">
            {uniqueDates.map((date) => (
              <div key={date} className="timeline-day">
                <div className="day-header">
                  <span className="day-date">{formatDate(date)}</span>
                  <span className="day-count">{groupedPhotos[date].length} photos</span>
                </div>
                
                {/* Daily Memo */}
                {memos[date] && (
                  <div className="day-memo">
                    <span className="memo-icon">✍️</span>
                    <p>{memos[date]}</p>
                  </div>
                )}

                {/* Photos Grid */}
                <div className="day-photos">
                  {groupedPhotos[date].map((photo) => {
                    const isMyPhoto = photo.author === user?.username;
                    return (
                      <div key={photo.id} className={`day-photo-wrapper ${!isMyPhoto ? 'shared-photo-wrapper' : ''}`}>
                        <div 
                          className={`day-photo ${!isMyPhoto ? 'shared-photo' : ''}`}
                          onClick={() => openPhoto(photo)}
                        >
                          <PhotoImage
                            photoId={photo.photoId}
                            filePath={photo.filePath}
                            fileName={photo.fileName}
                            className="day-photo-img"
                          />
                          {!isMyPhoto && (
                            <span className="photo-shared-indicator">👥</span>
                          )}
                          <span className={`photo-author-label ${!isMyPhoto ? 'other-author' : ''}`}>
                            {isMyPhoto ? 'Me' : photo.author}
                          </span>
                        </div>
                        {photo.memo && (
                          <div className="photo-memo-preview">
                            <span className="memo-text">{photo.memo}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Viewer Modal */}
      {selectedPhoto && selectedPhotoIndex !== null && (
        <div className="photo-modal" onClick={closePhotoModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closePhotoModal}>×</button>
            
            {/* Date Header with photo counter */}
            <div className="modal-date-header">
              <span>📅 {formatFullDate(selectedPhoto.date)}</span>
              <span className="photo-author-info">by {selectedPhoto.author}</span>
              <span className="photo-counter">{selectedPhotoIndex + 1} / {photos.length}</span>
            </div>

            {/* Photo with swipe support */}
            <div 
              className="modal-image"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Left Arrow */}
              {selectedPhotoIndex > 0 && (
                <button className="nav-btn nav-prev" onClick={goToPrevPhoto}>
                  ‹
                </button>
              )}
              
              <PhotoImage
                photoId={selectedPhoto.photoId}
                filePath={selectedPhoto.filePath}
                fileName={selectedPhoto.fileName}
                className="modal-photo-img"
              />
              
              {/* Right Arrow */}
              {selectedPhotoIndex < photos.length - 1 && (
                <button className="nav-btn nav-next" onClick={goToNextPhoto}>
                  ›
                </button>
              )}
            </div>

            {/* Expense Info - shown when photo is linked to an expense */}
            {selectedPhoto.type === 'expense' && selectedPhoto.expenseInfo && (
              <div className="modal-expense-info">
                <div className="expense-info-row">
                  <span className="expense-info-icon">{getCategoryEmoji(selectedPhoto.expenseInfo.category)}</span>
                  <span className="expense-info-name">{selectedPhoto.expenseInfo.place}</span>
                </div>
                <div className="expense-info-details">
                  <span className="expense-info-amount">
                    {selectedPhoto.expenseInfo.amount.toLocaleString()} {selectedPhoto.expenseInfo.currency}
                  </span>
                  <span className="expense-info-time">
                    🕐 {selectedPhoto.expenseInfo.time}
                  </span>
                </div>
              </div>
            )}

            {/* Chat-like Comments Section - shared with all participants */}
            <div className="comments-section">
              <div className="comments-header">
                <span className="comments-icon">💬</span>
                <span className="comments-title">Comments</span>
                <span className="comments-count">{(comments[String(selectedPhoto.photoId)] || []).length}</span>
                <span className="comments-shared-badge">👥 Shared</span>
              </div>

              <div className="comments-list">
                {(comments[String(selectedPhoto.photoId)] || []).length === 0 ? (
                  <div className="no-comments">
                    <p>💭 Leave the first comment!</p>
                    <small>All participants can see it</small>
                  </div>
                ) : (
                  (comments[String(selectedPhoto.photoId)] || []).map((comment) => (
                    <div 
                      key={comment.id} 
                      className={`comment-bubble ${comment.userId === user?.id ? 'my-comment' : 'other-comment'}`}
                    >
                      <div className="comment-header">
                        <span className="comment-author">{comment.author}</span>
                        <span className="comment-time">{formatCommentTime(comment.timestamp)}</span>
                      </div>
                      <p className="comment-text">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="comment-input-area">
                <input
                  type="text"
                  className="comment-input"
                  placeholder="Write a comment... (shared with all participants)"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  disabled={addingComment}
                />
                <button 
                  className="send-comment-btn"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || addingComment}
                >
                  {addingComment ? '...' : '➤'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav activeTab="images" />
    </div>
  );
}
