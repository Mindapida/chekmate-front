import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrips } from '../context/TripContext';
import { settlementApi } from '../api';
import AddParticipantModal from '../components/AddParticipantModal';
import './TripDetailPage.css';

interface Participant {
  id: number;
  name: string;
  username: string;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
  currency: string;
}

interface SettlementConfirmation {
  oderId: number;
  odername: string;
  confirmed: boolean;
  confirmedAt?: string;
}

// Storage key for settlement confirmations
const SETTLEMENT_CONFIRM_KEY = 'settlement_confirmations';

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { trips } = useTrips();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseCount, setExpenseCount] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [totalExpenseAmount, setTotalExpenseAmount] = useState(0);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementLoading, setSettlementLoading] = useState(false);
  
  // Settlement confirmation state
  const [confirmations, setConfirmations] = useState<{ [oderId: number]: boolean }>({});
  const [myConfirmed, setMyConfirmed] = useState(false);
  const [settlementComplete, setSettlementComplete] = useState(false);

  const trip = trips.find(t => t.id === Number(id));

  // Check if trip has ended
  const isTripEnded = trip ? new Date(trip.end_date) < new Date() : false;
  
  // Check if all participants confirmed
  const allConfirmed = participants.length > 0 && 
    myConfirmed && 
    participants.every(p => confirmations[p.id] === true);

  // Load all trip data
  const loadTripData = useCallback(() => {
    if (!trip) return;

    // Load participants
    const storedParticipants = localStorage.getItem(`trip_participants_${trip.id}`);
    if (storedParticipants) {
      setParticipants(JSON.parse(storedParticipants));
    }

    // Load expenses count and total
    let totalExpenses = 0;
    let totalAmount = 0;
    const startDate = new Date(trip.start_date);
    const endDate = new Date(trip.end_date);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const stored = localStorage.getItem(`expenses_${trip.id}_${dateStr}`);
      if (stored) {
        const expenses = JSON.parse(stored);
        totalExpenses += expenses.length;
        totalAmount += expenses.reduce((sum: number, exp: { amount: number }) => sum + exp.amount, 0);
      }
    }
    setExpenseCount(totalExpenses);
    setTotalExpenseAmount(totalAmount);

    // Load photo count
    let photos = 0;
    const expensePhotos = localStorage.getItem(`expense_photos_${trip.id}`);
    if (expensePhotos) {
      const photoData = JSON.parse(expensePhotos);
      Object.values(photoData).forEach((arr: any) => {
        photos += arr.length;
      });
    }
    const dumpPhotos = localStorage.getItem(`photo_dump_${trip.id}`);
    if (dumpPhotos) {
      const dumpData = JSON.parse(dumpPhotos);
      Object.values(dumpData).forEach((arr: any) => {
        photos += arr.length;
      });
    }
    setPhotoCount(photos);
    
    // Load settlement confirmations
    loadConfirmations();
  }, [trip]);
  
  // Load settlement confirmations from server/storage
  const loadConfirmations = useCallback(async () => {
    if (!trip) return;
    
    try {
      // Try to fetch from server first
      const response = await fetch(`/api/settlements/${trip.id}/confirmations`);
      if (response.ok) {
        const data = await response.json();
        const confirmMap: { [oderId: number]: boolean } = {};
        data.confirmations?.forEach((c: SettlementConfirmation) => {
          confirmMap[c.oderId] = c.confirmed;
        });
        setConfirmations(confirmMap);
        
        // Check if current oder confirmed
        const currentUserId = JSON.parse(localStorage.getItem('oder') || '{}').id;
        if (currentUserId && confirmMap[currentUserId]) {
          setMyConfirmed(true);
        }
        
        // Check if settlement is complete
        setSettlementComplete(data.complete || false);
        return;
      }
    } catch (error) {
      console.log('Server not available, using local storage');
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem(`${SETTLEMENT_CONFIRM_KEY}_${trip.id}`);
    if (stored) {
      const data = JSON.parse(stored);
      setConfirmations(data.confirmations || {});
      setMyConfirmed(data.myConfirmed || false);
      setSettlementComplete(data.complete || false);
    }
  }, [trip]);
  
  // Handle my confirmation
  const handleConfirmSettlement = async () => {
    if (!trip) return;
    
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const oderId = currentUser.id || 0;
    
    try {
      // Try to send to server first
      const response = await fetch(`/api/settlements/${trip.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oderId, confirmed: true })
      });
      
      if (response.ok) {
        setMyConfirmed(true);
        setConfirmations(prev => ({ ...prev, [oderId]: true }));
        // Reload confirmations to get server state
        loadConfirmations();
        return;
      }
    } catch (error) {
      console.log('Server not available, saving to local storage');
    }
    
    // Fallback to localStorage
    const newConfirmations = { ...confirmations, [oderId]: true };
    setConfirmations(newConfirmations);
    setMyConfirmed(true);
    
    // Save to localStorage
    const data = {
      confirmations: newConfirmations,
      myConfirmed: true,
      complete: participants.every(p => newConfirmations[p.id] === true) && true
    };
    localStorage.setItem(`${SETTLEMENT_CONFIRM_KEY}_${trip.id}`, JSON.stringify(data));
    
    // Check if all confirmed
    if (data.complete) {
      setSettlementComplete(true);
    }
  };
  
  // Handle complete settlement (only when all confirmed)
  const handleCompleteSettlement = async () => {
    if (!allConfirmed || !trip) return;
    
    try {
      // Mark as complete on server
      await fetch(`/api/settlements/${trip.id}/complete`, {
        method: 'POST'
      });
    } catch (error) {
      console.log('Server not available');
    }
    
    // Save completion to localStorage
    const data = {
      confirmations,
      myConfirmed: true,
      complete: true
    };
    localStorage.setItem(`${SETTLEMENT_CONFIRM_KEY}_${trip.id}`, JSON.stringify(data));
    setSettlementComplete(true);
    
    alert('정산이 완료되었습니다! 🎉');
  };

  useEffect(() => {
    loadTripData();
  }, [loadTripData]);
  
  // Refresh confirmations periodically to sync with server
  useEffect(() => {
    if (!isTripEnded || !trip) return;
    
    const interval = setInterval(() => {
      loadConfirmations();
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, [isTripEnded, trip, loadConfirmations]);

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

  // Calculate settlement
  const handleCalculateSettlement = async () => {
    if (!trip || participants.length === 0) return;
    
    setSettlementLoading(true);
    
    try {
      // Try backend API first
      const result = await settlementApi.calculate(trip.id);
      if (result && result.length > 0) {
        const formatted = result.map(s => ({
          from: participants.find(p => p.id === s.from_participant_id)?.name || `User ${s.from_participant_id}`,
          to: participants.find(p => p.id === s.to_participant_id)?.name || `User ${s.to_participant_id}`,
          amount: s.amount,
          currency: s.currency,
        }));
        setSettlements(formatted);
        setSettlementLoading(false);
        return;
      }
    } catch (error) {
      console.log('Backend settlement failed, calculating locally...');
    }

    // Local calculation fallback
    // Load all expenses and calculate who owes whom
    const expensesByPayer: { [payerId: number]: number } = {};
    const totalPerPerson: { [personId: number]: number } = {};
    
    // Initialize with 0 and include "Me" (id: 0)
    [0, ...participants.map(p => p.id)].forEach(id => {
      expensesByPayer[id] = 0;
      totalPerPerson[id] = 0;
    });

    // Sum up expenses by payer
    const startDate = new Date(trip.start_date);
    const endDate = new Date(trip.end_date);
    let grandTotal = 0;
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const stored = localStorage.getItem(`expenses_${trip.id}_${dateStr}`);
      if (stored) {
        const expenses = JSON.parse(stored);
        expenses.forEach((exp: { amount: number; paid_by: number }) => {
          const payerId = exp.paid_by || 0; // Default to "Me" if not specified
          expensesByPayer[payerId] = (expensesByPayer[payerId] || 0) + exp.amount;
          grandTotal += exp.amount;
        });
      }
    }

    // Calculate equal share
    const peopleCount = participants.length + 1; // +1 for "Me"
    const equalShare = grandTotal / peopleCount;

    // Calculate who owes whom
    const balances: { id: number; name: string; balance: number }[] = [];
    
    // "Me" balance
    balances.push({
      id: 0,
      name: 'Me',
      balance: expensesByPayer[0] - equalShare,
    });
    
    // Other participants
    participants.forEach(p => {
      balances.push({
        id: p.id,
        name: p.name,
        balance: (expensesByPayer[p.id] || 0) - equalShare,
      });
    });

    // Generate settlement transactions
    const creditors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance);
    const debtors = balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance);
    
    const newSettlements: Settlement[] = [];
    
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
      
      if (amount > 0) {
        newSettlements.push({
          from: debtor.name,
          to: creditor.name,
          amount: Math.round(amount),
          currency: 'KRW',
        });
      }
      
      debtor.balance += amount;
      creditor.balance -= amount;
      
      if (Math.abs(debtor.balance) < 1) i++;
      if (creditor.balance < 1) j++;
    }

    setSettlements(newSettlements);
    setSettlementLoading(false);
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
            {!isTripEnded ? (
              <button className="add-participant-btn" onClick={() => setIsModalOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Add Participant
              </button>
            ) : (
              <span className="trip-ended-badge">여행 종료</span>
            )}
          </div>

          {participants.length === 0 ? (
            <p className="empty-text">No participants yet</p>
          ) : (
            <div className="participants-list">
              {participants.map(participant => (
                <div key={participant.id} className="participant-chip">
                  <span className="participant-name">{participant.name || participant.username}</span>
                  {!isTripEnded && (
                    <button 
                      className="remove-btn"
                      onClick={() => handleRemoveParticipant(participant.id)}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settlement Section */}
        <div className="section">
          <h2>Settlement 💰</h2>
          {!isTripEnded ? (
            <div className="settlement-card pending">
              <span className="settlement-icon">⏳</span>
              <p>Settlement will be available after trip ends</p>
              <p className="end-date">Trip ends: {trip.end_date}</p>
            </div>
          ) : settlementComplete ? (
            <div className="settlement-card complete">
              <span className="settlement-icon">🎉</span>
              <p>정산이 완료되었습니다!</p>
              {settlements.length > 0 && (
                <div className="settlement-list">
                  {settlements.map((s, idx) => (
                    <div key={idx} className="settlement-item">
                      <span className="from-user">{s.from}</span>
                      <span className="arrow">→</span>
                      <span className="to-user">{s.to}</span>
                      <span className="amount">{s.amount.toLocaleString()} {s.currency}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : settlements.length > 0 ? (
            <div className="settlement-card with-settlements">
              <div className="settlement-list">
                {settlements.map((s, idx) => (
                  <div key={idx} className="settlement-item">
                    <span className="from-user">{s.from}</span>
                    <span className="arrow">→</span>
                    <span className="to-user">{s.to}</span>
                    <span className="amount">{s.amount.toLocaleString()} {s.currency}</span>
                  </div>
                ))}
              </div>
              
              {/* Confirmation Section */}
              <div className="confirmation-section">
                <h4>정산 동의 현황</h4>
                <p className="confirm-desc">모든 참가자가 동의하면 정산이 완료됩니다</p>
                
                {/* Participant avatars with confirmation status */}
                <div className="participant-avatars">
                  {/* Me */}
                  <div className={`avatar-item ${myConfirmed ? 'confirmed' : 'pending'}`}>
                    <div className="avatar-circle">
                      <span className="avatar-name">나</span>
                      {myConfirmed && <span className="check-mark">✓</span>}
                    </div>
                    <span className="avatar-label">나</span>
                  </div>
                  
                  {/* Other participants */}
                  {participants.map(p => (
                    <div 
                      key={p.id} 
                      className={`avatar-item ${confirmations[p.id] ? 'confirmed' : 'pending'}`}
                    >
                      <div className="avatar-circle">
                        <span className="avatar-name">
                          {(p.name || p.username || '?').charAt(0).toUpperCase()}
                        </span>
                        {confirmations[p.id] && <span className="check-mark">✓</span>}
                      </div>
                      <span className="avatar-label">{p.name || p.username}</span>
                    </div>
                  ))}
                </div>
                
                {/* Confirmation buttons */}
                <div className="confirm-actions">
                  {!myConfirmed ? (
                    <button 
                      className="confirm-btn agree"
                      onClick={handleConfirmSettlement}
                    >
                      ✓ 정산에 동의합니다
                    </button>
                  ) : (
                    <button 
                      className="confirm-btn agreed"
                      disabled
                    >
                      ✓ 동의 완료
                    </button>
                  )}
                  
                  {allConfirmed && (
                    <button 
                      className="confirm-btn complete"
                      onClick={handleCompleteSettlement}
                    >
                      🎉 정산 완료하기
                    </button>
                  )}
                </div>
                
                {!allConfirmed && (
                  <p className="waiting-msg">
                    {participants.filter(p => !confirmations[p.id]).length + (myConfirmed ? 0 : 1)}명의 동의를 기다리는 중...
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="settlement-card ready">
              <span className="settlement-icon">✅</span>
              <p>Trip has ended! Ready to settle up.</p>
              
              {/* Show participant confirmation status even before calculation */}
              {participants.length > 0 && (
                <div className="confirmation-section">
                  <h4>정산 동의 현황</h4>
                  <p className="confirm-desc">정산 계산 전 모든 참가자의 동의가 필요합니다</p>
                  
                  {/* Participant avatars with confirmation status */}
                  <div className="participant-avatars">
                    {/* Me */}
                    <div className={`avatar-item ${myConfirmed ? 'confirmed' : 'pending'}`}>
                      <div className="avatar-circle">
                        <span className="avatar-name">나</span>
                        {myConfirmed && <span className="check-mark">✓</span>}
                      </div>
                      <span className="avatar-label">나</span>
                    </div>
                    
                    {/* Other participants */}
                    {participants.map(p => (
                      <div 
                        key={p.id} 
                        className={`avatar-item ${confirmations[p.id] ? 'confirmed' : 'pending'}`}
                      >
                        <div className="avatar-circle">
                          <span className="avatar-name">
                            {(p.name || p.username || '?').charAt(0).toUpperCase()}
                          </span>
                          {confirmations[p.id] && <span className="check-mark">✓</span>}
                        </div>
                        <span className="avatar-label">{p.name || p.username}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Confirmation buttons */}
                  <div className="confirm-actions">
                    {!myConfirmed ? (
                      <button 
                        className="confirm-btn agree"
                        onClick={handleConfirmSettlement}
                      >
                        ✓ 정산에 동의합니다
                      </button>
                    ) : (
                      <button 
                        className="confirm-btn agreed"
                        disabled
                      >
                        ✓ 동의 완료
                      </button>
                    )}
                  </div>
                  
                  {!allConfirmed && (
                    <p className="waiting-msg">
                      {participants.filter(p => !confirmations[p.id]).length + (myConfirmed ? 0 : 1)}명의 동의를 기다리는 중...
                    </p>
                  )}
                </div>
              )}
              
              <button 
                className="settle-btn"
                onClick={handleCalculateSettlement}
                disabled={settlementLoading || participants.length === 0 || !allConfirmed}
              >
                {settlementLoading ? 'Calculating...' : allConfirmed ? 'Calculate Settlement' : '모든 참가자 동의 필요'}
              </button>
              {participants.length === 0 && (
                <p className="warning">Add participants to calculate settlement</p>
              )}
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{participants.length}</span>
            <span className="stat-label">Participants</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{expenseCount}</span>
            <span className="stat-label">Expenses</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{photoCount}</span>
            <span className="stat-label">Photos</span>
          </div>
        </div>

        {/* Total Spending */}
        {totalExpenseAmount > 0 && (
          <div className="total-spending">
            <span className="spending-label">Total Spending</span>
            <span className="spending-value">{totalExpenseAmount.toLocaleString()} KRW</span>
          </div>
        )}
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

















