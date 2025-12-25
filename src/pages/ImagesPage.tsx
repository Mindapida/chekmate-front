import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import BottomNav, { saveLastPage } from '../components/BottomNav';
import './ImagesPage.css';

interface PhotoEntry {
  id: string;
  type: 'expense' | 'dump';
  photo: string;
  date: string;
  expenseId?: string;
  expenseInfo?: {
    place: string;
    amount: number;
    currency: string;
    category: string;
    time: string;
  };
}

interface MemoData {
  [dateKey: string]: string;
}

interface ExpenseMemoData {
  [expenseKey: string]: string;
}

interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  isMe: boolean;
}

interface CommentData {
  [photoId: string]: Comment[];
}

const PHOTO_STORAGE_KEY = 'expense_photos';
const DUMP_STORAGE_KEY = 'photo_dump';
const MEMO_STORAGE_KEY = 'daily_memo';
const EXPENSE_STORAGE_KEY = 'expenses';
const EXPENSE_MEMO_STORAGE_KEY = 'expense_memos';
const COMMENTS_STORAGE_KEY = 'photo_comments';

export default function ImagesPage() {
  const navigate = useNavigate();
  const { currentTrip } = useTrips();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [memos, setMemos] = useState<MemoData>({});
  const [expenseMemos, setExpenseMemos] = useState<ExpenseMemoData>({});
  const [comments, setComments] = useState<CommentData>({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('timeline');
  const [newComment, setNewComment] = useState('');
  
  // Swipe handling
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  
  // Get current selected photo
  const selectedPhoto = selectedPhotoIndex !== null ? photos[selectedPhotoIndex] : null;

  // Save current page on mount
  useEffect(() => {
    saveLastPage('/images');
  }, []);

  useEffect(() => {
    if (!currentTrip) return;

    const loadPhotos = () => {
      const allPhotos: PhotoEntry[] = [];

      // Load expense photos
      const expensePhotos = localStorage.getItem(`${PHOTO_STORAGE_KEY}_${currentTrip.id}`);
      if (expensePhotos) {
        const photoData = JSON.parse(expensePhotos);
        Object.entries(photoData).forEach(([key, photos]) => {
          const [date, expenseId] = key.split('_');
          // Try to get expense info
          const expensesStored = localStorage.getItem(`${EXPENSE_STORAGE_KEY}_${currentTrip.id}_${date}`);
          let expenseInfo: { place: string; amount: number; currency: string; category: string; time: string } | undefined;
          if (expensesStored) {
            const expenses = JSON.parse(expensesStored);
            const expense = expenses.find((e: any) => e.id.toString() === expenseId);
            if (expense) {
              expenseInfo = {
                place: expense.place || 'No place',
                amount: expense.amount,
                currency: expense.currency,
                category: expense.category,
                time: expense.time || '--:--'
              };
            }
          }
          (photos as string[]).forEach((photo, idx) => {
            allPhotos.push({
              id: `expense_${key}_${idx}`,
              type: 'expense',
              photo,
              date,
              expenseId: key, // Store the expense key for memo lookup
              expenseInfo
            });
          });
        });
      }

      // Load photo dumps
      const dumpPhotos = localStorage.getItem(`${DUMP_STORAGE_KEY}_${currentTrip.id}`);
      if (dumpPhotos) {
        const dumpData = JSON.parse(dumpPhotos);
        Object.entries(dumpData).forEach(([date, photos]) => {
          (photos as string[]).forEach((photo, idx) => {
            allPhotos.push({
              id: `dump_${date}_${idx}`,
              type: 'dump',
              photo,
              date
            });
          });
        });
      }

      // Sort by date (newest first)
      allPhotos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPhotos(allPhotos);

      // Load memos
      const memoData = localStorage.getItem(`${MEMO_STORAGE_KEY}_${currentTrip.id}`);
      if (memoData) {
        setMemos(JSON.parse(memoData));
      }

      // Load expense memos
      const expenseMemoData = localStorage.getItem(`${EXPENSE_MEMO_STORAGE_KEY}_${currentTrip.id}`);
      if (expenseMemoData) {
        setExpenseMemos(JSON.parse(expenseMemoData));
      }

      // Load comments
      const commentsData = localStorage.getItem(`${COMMENTS_STORAGE_KEY}_${currentTrip.id}`);
      if (commentsData) {
        setComments(JSON.parse(commentsData));
      }
    };

    loadPhotos();
  }, [currentTrip]);

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
      'shopping': '🛍️', 'activity': '🎭', 'ticket': '🎫', 'gift': '🎁', 'cafe': '☕'
    };
    return categories[category?.toLowerCase()] || '📸';
  };

  // Get expense memo for a photo
  const getPhotoMemo = (photo: PhotoEntry): string | null => {
    if (photo.type === 'expense' && photo.expenseId) {
      return expenseMemos[photo.expenseId] || null;
    }
    return null;
  };

  // Add a new comment to a photo
  const handleAddComment = () => {
    if (!selectedPhoto || !newComment.trim() || !currentTrip) return;

    const comment: Comment = {
      id: Date.now().toString(),
      text: newComment.trim(),
      author: 'Me',
      timestamp: new Date().toISOString(),
      isMe: true,
    };

    const photoComments = comments[selectedPhoto.id] || [];
    const updatedComments = {
      ...comments,
      [selectedPhoto.id]: [...photoComments, comment],
    };

    setComments(updatedComments);
    localStorage.setItem(`${COMMENTS_STORAGE_KEY}_${currentTrip.id}`, JSON.stringify(updatedComments));
    setNewComment('');
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
          </div>
          <span className="trip-dates-small">
            {currentTrip.name} • {photos.length} photos
          </span>
        </div>

        {/* Photos Container */}
        {photos.length === 0 ? (
          <div className="empty-images">
            <div className="empty-icon">📷</div>
            <h3>No photos yet</h3>
            <p>Add photos from the Calendar → Photo</p>
            <button className="go-calendar-btn" onClick={() => navigate('/calendar')}>
              Go to Calendar
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid-view">
            {photos.map((photo) => (
              <div 
                key={photo.id} 
                className="grid-photo"
                onClick={() => openPhoto(photo)}
              >
                <img src={photo.photo} alt="" />
                {photo.type === 'expense' && (
                  <span className="photo-type-badge expense">💰</span>
                )}
              </div>
            ))}
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
                    const photoMemo = getPhotoMemo(photo);
                    return (
                      <div key={photo.id} className="day-photo-wrapper">
                        <div 
                          className="day-photo"
                          onClick={() => openPhoto(photo)}
                        >
                          <img src={photo.photo} alt="" />
                          {photo.type === 'expense' && photo.expenseInfo && (
                            <div className="photo-expense-label">
                              <span>{getCategoryEmoji(photo.expenseInfo.category)}</span>
                              <span>{photo.expenseInfo.amount.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        {photoMemo && (
                          <div className="photo-memo-preview">
                            <span className="memo-text">{photoMemo}</span>
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
              
              <img src={selectedPhoto.photo} alt="" />
              
              {/* Right Arrow */}
              {selectedPhotoIndex < photos.length - 1 && (
                <button className="nav-btn nav-next" onClick={goToNextPhoto}>
                  ›
                </button>
              )}
            </div>

            {/* Chat-like Comments Section - directly below photo */}
            <div className="comments-section">
              <div className="comments-header">
                <span className="comments-icon">💬</span>
                <span className="comments-title">Comments</span>
                <span className="comments-count">{(comments[selectedPhoto.id] || []).length}</span>
              </div>

              <div className="comments-list">
                {(comments[selectedPhoto.id] || []).length === 0 ? (
                  <div className="no-comments">
                    <p>💭 첫 댓글을 남겨보세요!</p>
                  </div>
                ) : (
                  (comments[selectedPhoto.id] || []).map((comment) => (
                    <div 
                      key={comment.id} 
                      className={`comment-bubble ${comment.isMe ? 'my-comment' : 'other-comment'}`}
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
                  placeholder="댓글을 입력하세요..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <button 
                  className="send-comment-btn"
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                >
                  ➤
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
