import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import BottomNav from '../components/BottomNav';
import './ImagesPage.css';

interface PhotoEntry {
  id: string;
  type: 'expense' | 'dump';
  photo: string;
  date: string;
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

const PHOTO_STORAGE_KEY = 'expense_photos';
const DUMP_STORAGE_KEY = 'photo_dump';
const MEMO_STORAGE_KEY = 'daily_memo';
const EXPENSE_STORAGE_KEY = 'expenses';

export default function ImagesPage() {
  const navigate = useNavigate();
  const { currentTrip } = useTrips();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [memos, setMemos] = useState<MemoData>({});
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoEntry | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('timeline');

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
          let expenseInfo;
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
                onClick={() => setSelectedPhoto(photo)}
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
                  {groupedPhotos[date].map((photo) => (
                    <div 
                      key={photo.id} 
                      className="day-photo"
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <img src={photo.photo} alt="" />
                      {photo.type === 'expense' && photo.expenseInfo && (
                        <div className="photo-expense-label">
                          <span>{getCategoryEmoji(photo.expenseInfo.category)}</span>
                          <span>{photo.expenseInfo.amount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div className="photo-modal" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedPhoto(null)}>×</button>
            
            <div className="modal-image">
              <img src={selectedPhoto.photo} alt="" />
            </div>

            <div className="modal-info">
              <div className="modal-date">📅 {formatFullDate(selectedPhoto.date)}</div>
              
              {selectedPhoto.type === 'expense' && selectedPhoto.expenseInfo && (
                <div className="modal-expense">
                  <div className="expense-row">
                    <span className="emoji">{getCategoryEmoji(selectedPhoto.expenseInfo.category)}</span>
                    <span className="category">{selectedPhoto.expenseInfo.category}</span>
                    <span className="time">{selectedPhoto.expenseInfo.time}</span>
                  </div>
                  <div className="expense-place">{selectedPhoto.expenseInfo.place}</div>
                  <div className="expense-amount">
                    {selectedPhoto.expenseInfo.amount.toLocaleString()} {selectedPhoto.expenseInfo.currency}
                  </div>
                </div>
              )}

              {selectedPhoto.type === 'dump' && (
                <div className="modal-dump-label">📷 Photo Dump</div>
              )}

              {memos[selectedPhoto.date] && (
                <div className="modal-memo">
                  <span className="memo-label">✍️ Memo</span>
                  <p>{memos[selectedPhoto.date]}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav activeTab="images" />
    </div>
  );
}
