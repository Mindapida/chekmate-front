"""
Diary management routes for photos and memos.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import case
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.models.user import User
from app.models.diary import DiaryEntry, DiaryPhoto
from app.schemas.diary import (
    DiaryEntryResponse, DiaryEntryCreate, PhotoUpload, 
    PhotoUpdate, MemoCreate, DiaryPhotoResponse
)
from app.api.dependencies import get_current_user
from app.api.routes.trips import check_trip_access
import os
import uuid
from app.core.config import settings

router = APIRouter(prefix="/diary", tags=["diary"])


# Expense-linked diary endpoints (must come before date-based routes)
@router.post("/expenses/{expense_id}/photos", response_model=DiaryEntryResponse, status_code=status.HTTP_201_CREATED)
async def upload_photos_for_expense(
    expense_id: int,
    file: UploadFile = File(...),
    memo: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload ONE photo for a specific expense (1 photo per user/expense).
    
    You can upload both photo and memo together:
    - file: The photo file
    - memo: (optional) Memo text to save with the expense
    """
    from app.models.expense import Expense
    
    # Get expense and verify access
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    check_trip_access(expense.trip_id, current_user.id, db)
    
    # Check if photo already exists for this expense
    existing_entry = db.query(DiaryEntry).filter(
        DiaryEntry.expense_id == expense_id,
        DiaryEntry.user_id == current_user.id
    ).first()
    
    if existing_entry:
        existing_photo = db.query(DiaryPhoto).filter(
            DiaryPhoto.diary_entry_id == existing_entry.id
        ).first()
        
        if existing_photo:
            # Delete existing photo file
            if os.path.exists(existing_photo.file_path):
                os.remove(existing_photo.file_path)
            # Delete existing photo record
            db.delete(existing_photo)
            diary_entry = existing_entry
        else:
            diary_entry = existing_entry
    else:
        # Create new diary entry linked to expense
        diary_entry = DiaryEntry(
            trip_id=expense.trip_id,
            user_id=current_user.id,
            date=expense.date,
            expense_id=expense_id,
            memo=memo
        )
        db.add(diary_entry)
        db.flush()
    
    # Update memo if provided (can update existing memo or set new one)
    if memo is not None:
        diary_entry.memo = memo
    
    # Validate file type
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}"
        )
    
    # Save uploaded file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Create photo record (memo is stored at DiaryEntry level, not photo level)
    photo = DiaryPhoto(
        diary_entry_id=diary_entry.id,
        file_path=file_path,
        file_name=file.filename,
        order_index=0  # Only one photo per expense
    )
    db.add(photo)
    db.commit()
    
    # Reload diary entry with relationships
    diary_entry = db.query(DiaryEntry).options(
        joinedload(DiaryEntry.user),
        joinedload(DiaryEntry.photos)
    ).filter(DiaryEntry.id == diary_entry.id).first()
    
    # Build response with photo and memo
    photo_responses = [
        DiaryPhotoResponse(
            id=p.id,
            file_path=p.file_path,
            file_name=p.file_name,
            memo=None,  # Always None - memo is stored in DiaryEntry.memo
            order_index=p.order_index,
            created_at=p.created_at
        )
        for p in diary_entry.photos
    ]
    
    return DiaryEntryResponse(
        id=diary_entry.id,
        trip_id=diary_entry.trip_id,
        user_id=diary_entry.user_id,
        username=diary_entry.user.username,
        date=diary_entry.date,
        expense_id=diary_entry.expense_id,
        memo=diary_entry.memo,
        photos=photo_responses,
        created_at=diary_entry.created_at,
        updated_at=diary_entry.updated_at
    )


@router.post("/expenses/{expense_id}/memo", response_model=DiaryEntryResponse, status_code=status.HTTP_201_CREATED)
@router.put("/expenses/{expense_id}/memo", response_model=DiaryEntryResponse)
async def create_or_update_memo_for_expense(
    expense_id: int,
    memo_data: MemoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add or update memo for a specific expense.
    
    POST: Create or update memo
    PUT: Update memo (same as POST, provided for RESTful API convention)
    """
    from app.models.expense import Expense
    
    # Get expense and verify access
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    check_trip_access(expense.trip_id, current_user.id, db)
    
    # Find or create diary entry linked to expense
    diary_entry = db.query(DiaryEntry).options(
        joinedload(DiaryEntry.photos)
    ).filter(
        DiaryEntry.expense_id == expense_id,
        DiaryEntry.user_id == current_user.id
    ).first()
    
    if diary_entry:
        diary_entry.memo = memo_data.memo
    else:
        diary_entry = DiaryEntry(
            trip_id=expense.trip_id,
            user_id=current_user.id,
            date=expense.date,
            expense_id=expense_id,
            memo=memo_data.memo
        )
        db.add(diary_entry)
    
    db.commit()
    
    # Reload with relationships
    diary_entry = db.query(DiaryEntry).options(
        joinedload(DiaryEntry.user),
        joinedload(DiaryEntry.photos)
    ).filter(DiaryEntry.id == diary_entry.id).first()
    
    # Build response
    photo_responses = [
        DiaryPhotoResponse(
            id=p.id,
            file_path=p.file_path,
            file_name=p.file_name,
            memo=None,  # Always None - memo is stored in DiaryEntry.memo
            order_index=p.order_index,
            created_at=p.created_at
        )
        for p in diary_entry.photos
    ]
    
    return DiaryEntryResponse(
        id=diary_entry.id,
        trip_id=diary_entry.trip_id,
        user_id=diary_entry.user_id,
        username=diary_entry.user.username,
        date=diary_entry.date,
        expense_id=diary_entry.expense_id,
        memo=diary_entry.memo,
        photos=photo_responses,
        created_at=diary_entry.created_at,
        updated_at=diary_entry.updated_at
    )


@router.delete("/expenses/{expense_id}/photos")
async def delete_photo_for_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete photo linked to a specific expense. Indexed by expense_id."""
    from app.models.expense import Expense
    
    # Get expense and verify access
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    check_trip_access(expense.trip_id, current_user.id, db)
    
    # Find diary entry linked to expense
    diary_entry = db.query(DiaryEntry).filter(
        DiaryEntry.expense_id == expense_id,
        DiaryEntry.user_id == current_user.id
    ).first()
    
    if not diary_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diary entry not found for this expense"
        )
    
    # Find photo linked to this expense
    photo = db.query(DiaryPhoto).filter(
        DiaryPhoto.diary_entry_id == diary_entry.id
    ).first()
    
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found for this expense"
        )
    
    # Delete file
    if os.path.exists(photo.file_path):
        os.remove(photo.file_path)
    
    db.delete(photo)
    db.commit()
    
    return {"message": "Expense photo deleted successfully"}


@router.delete("/expenses/{expense_id}/memo")
async def delete_memo_for_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete memo linked to a specific expense. Indexed by expense_id."""
    from app.models.expense import Expense
    
    # Get expense and verify access
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    check_trip_access(expense.trip_id, current_user.id, db)
    
    # Find diary entry linked to expense
    diary_entry = db.query(DiaryEntry).filter(
        DiaryEntry.expense_id == expense_id,
        DiaryEntry.user_id == current_user.id
    ).first()
    
    if not diary_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diary entry not found for this expense"
        )
    
    if not diary_entry.memo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memo not found for this expense"
        )
    
    diary_entry.memo = None
    db.commit()
    
    return {"message": "Expense memo deleted successfully"}


@router.get("/expenses/{expense_id}", response_model=DiaryEntryResponse)
async def get_diary_entry_for_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get diary entry (photos and memo) for a specific expense."""
    from app.models.expense import Expense
    
    # Get expense and verify access
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    check_trip_access(expense.trip_id, current_user.id, db)
    
    # Load diary entry with relationships
    diary_entry = db.query(DiaryEntry).options(
        joinedload(DiaryEntry.user),
        joinedload(DiaryEntry.photos)
    ).filter(
        DiaryEntry.expense_id == expense_id,
        DiaryEntry.user_id == current_user.id
    ).first()
    
    if not diary_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diary entry not found for this expense"
        )
    
    # Build response with username and photos
    # Note: memo is stored at DiaryEntry level, not photo level (always None in photo response)
    photo_responses = [
        DiaryPhotoResponse(
            id=p.id,
            file_path=p.file_path,
            file_name=p.file_name,
            memo=None,  # Always None - memo is stored in DiaryEntry.memo, not DiaryPhoto.memo
            order_index=p.order_index,
            created_at=p.created_at
        )
        for p in diary_entry.photos
    ]
    
    return DiaryEntryResponse(
        id=diary_entry.id,
        trip_id=diary_entry.trip_id,
        user_id=diary_entry.user_id,
        username=diary_entry.user.username,
        date=diary_entry.date,
        expense_id=diary_entry.expense_id,
        memo=diary_entry.memo,
        photos=photo_responses,
        created_at=diary_entry.created_at,
        updated_at=diary_entry.updated_at
    )


# Date-based diary endpoints
@router.get("/{trip_id}/{date}", response_model=List[DiaryEntryResponse])
async def get_diary_entry(
    trip_id: int,
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all diary entries for a specific date (including both expense-linked and date-based entries).
    
    Note: Automatically merges duplicate date-based entries if found (keeps oldest, merges photos and memo).
    """
    check_trip_access(trip_id, current_user.id, db)
    
    # First, check for and merge duplicate date-based entries
    date_based_entries = db.query(DiaryEntry).options(
        joinedload(DiaryEntry.photos)
    ).filter(
        DiaryEntry.trip_id == trip_id,
        DiaryEntry.user_id == current_user.id,
        DiaryEntry.date == date,
        DiaryEntry.expense_id.is_(None)  # Only date-based entries
    ).order_by(DiaryEntry.created_at.asc()).all()
    
    # Merge duplicate date-based entries if found
    if len(date_based_entries) > 1:
        primary_entry = date_based_entries[0]
        
        # Collect all photos from all entries (before modifying)
        all_photos = []
        for entry in date_based_entries:
            # Refresh to ensure photos are loaded
            db.refresh(entry, ['photos'])
            for photo in entry.photos:
                all_photos.append(photo)
        
        # Merge memo (use the oldest non-empty memo, or the most recent if all have memos)
        if not primary_entry.memo:
            for entry in date_based_entries:
                if entry.memo:
                    primary_entry.memo = entry.memo
                    break
        else:
            # If primary has memo, check if any other entry has a more recent memo
            for entry in date_based_entries[1:]:
                if entry.memo and entry.updated_at > primary_entry.updated_at:
                    primary_entry.memo = entry.memo
        
        # Reorder photos by their original order_index and creation time
        all_photos.sort(key=lambda p: (p.order_index if p.order_index is not None else 999, p.created_at))
        
        # Reassign all photos to primary entry and reorder
        for idx, photo in enumerate(all_photos):
            photo.diary_entry_id = primary_entry.id
            photo.order_index = idx
        
        # Delete duplicate entries (keep only the primary one)
        # Need to delete entries AFTER moving photos, but before commit
        for entry in date_based_entries[1:]:
            db.delete(entry)
        
        db.flush()  # Flush changes before commit
        db.commit()
        
        # Refresh primary entry to get updated photos
        db.refresh(primary_entry, ['photos'])
    
    # Get all diary entries for this date (both expense-linked and date-based)
    # MySQL doesn't support NULLS LAST, so we use CASE to put NULLs last
    # We order by: expense_id IS NULL (0 for expense-linked, 1 for date-based)
    # Then by expense_id ASC, then by created_at ASC
    # This puts expense-linked entries first, then date-based entries
    diary_entries = db.query(DiaryEntry).options(
        joinedload(DiaryEntry.user),
        joinedload(DiaryEntry.photos)
    ).filter(
        DiaryEntry.trip_id == trip_id,
        DiaryEntry.user_id == current_user.id,
        DiaryEntry.date == date
        # Removed expense_id.is_(None) filter to include both expense-linked and date-based entries
    ).order_by(
        case((DiaryEntry.expense_id.is_(None), 1), else_=0).asc(),  # NULLs last: 0 (expense-linked) first, then 1 (date-based)
        DiaryEntry.expense_id.asc(),  # Then by expense_id
        DiaryEntry.created_at.asc()  # Finally by creation time
    ).all()
    
    if not diary_entries:
        return []  # Return empty list instead of 404
    
    # Build response list
    result = []
    for diary_entry in diary_entries:
        # Note: memo is stored at DiaryEntry level, not photo level (always None in photo response)
        photo_responses = [
            DiaryPhotoResponse(
                id=p.id,
                file_path=p.file_path,
                file_name=p.file_name,
                memo=None,  # Always None - memo is stored in DiaryEntry.memo, not DiaryPhoto.memo
                order_index=p.order_index,
                created_at=p.created_at
            )
            for p in diary_entry.photos
        ]
        
        result.append(DiaryEntryResponse(
            id=diary_entry.id,
            trip_id=diary_entry.trip_id,
            user_id=diary_entry.user_id,
            username=diary_entry.user.username,
            date=diary_entry.date,
            expense_id=diary_entry.expense_id,
            memo=diary_entry.memo,
            photos=photo_responses,
            created_at=diary_entry.created_at,
            updated_at=diary_entry.updated_at
        ))
    
    return result


@router.post("/{trip_id}/{date}/photos", response_model=List[DiaryPhotoResponse], status_code=status.HTTP_201_CREATED)
async def upload_photos(
    trip_id: int,
    date: date,
    files: List[UploadFile] = File(...),
    memo: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload photos for a diary entry (max 10 per user/date, separate from expense-linked photos)."""
    check_trip_access(trip_id, current_user.id, db)
    
    # Get all date-based diary entries for this date (in case there are duplicates from legacy data)
    # Only one date-based entry should exist per user/date
    diary_entries = db.query(DiaryEntry).filter(
        DiaryEntry.trip_id == trip_id,
        DiaryEntry.user_id == current_user.id,
        DiaryEntry.date == date,
        DiaryEntry.expense_id.is_(None)  # Only count date-based entries, not expense-linked
    ).order_by(DiaryEntry.created_at.asc()).all()  # Get oldest first
    
    if diary_entries:
        # Use the oldest entry (primary entry)
        diary_entry = diary_entries[0]
        
        # If there are multiple entries, merge photos and memo from other entries into the primary one
        if len(diary_entries) > 1:
            # Get all photos from all entries
            all_photos = []
            for entry in diary_entries:
                for photo in entry.photos:
                    photo.diary_entry_id = diary_entry.id
                    all_photos.append(photo)
            
            # Merge memo (use the oldest non-empty memo)
            if not diary_entry.memo:
                for entry in diary_entries:
                    if entry.memo:
                        diary_entry.memo = entry.memo
                        break
            
            # Reorder photos by their original order_index and creation time
            all_photos.sort(key=lambda p: (p.order_index, p.created_at))
            for idx, photo in enumerate(all_photos):
                photo.order_index = idx
            
            # Delete duplicate entries (keep only the primary one)
            for entry in diary_entries[1:]:
                db.delete(entry)
    else:
        # Create new diary entry
        diary_entry = DiaryEntry(
            trip_id=trip_id,
            user_id=current_user.id,
            date=date,
            memo=memo
        )
        db.add(diary_entry)
        db.flush()
    
    # Update memo if provided
    if memo is not None:
        diary_entry.memo = memo
    
    # Count existing photos
    existing_count = db.query(DiaryPhoto).filter(
        DiaryPhoto.diary_entry_id == diary_entry.id
    ).count()
    
    if existing_count + len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 photos allowed per user per date (date-based diary, separate from expense-linked photos)"
        )
    
    # Save uploaded files
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    uploaded_photos = []
    
    for idx, file in enumerate(files):
        # Validate file type
        if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type: {file.content_type}"
            )
        
        # Generate unique filename
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Create photo record
        photo = DiaryPhoto(
            diary_entry_id=diary_entry.id,
            file_path=file_path,
            file_name=file.filename,
            order_index=existing_count + idx
        )
        db.add(photo)
        uploaded_photos.append(photo)
    
    db.commit()
    
    for photo in uploaded_photos:
        db.refresh(photo)
    
    return uploaded_photos


@router.put("/{trip_id}/{date}/photos/{photo_id}", response_model=DiaryPhotoResponse)
async def update_photo(
    trip_id: int,
    date: date,
    photo_id: int,
    photo_data: PhotoUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update photo metadata. Indexed by trip_id, date, and photo_id.
    
    Note: memo is stored at DiaryEntry level, not photo level.
    If you need to update memo, use the memo endpoints instead.
    """
    check_trip_access(trip_id, current_user.id, db)
    
    # Get photo and verify it belongs to the specified trip_id and date
    photo = db.query(DiaryPhoto).join(DiaryEntry).filter(
        DiaryPhoto.id == photo_id,
        DiaryEntry.trip_id == trip_id,
        DiaryEntry.date == date
    ).first()
    
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found for this trip_id, date, and photo_id"
        )
    
    # Note: photo_data.memo is ignored - memo is stored in DiaryEntry.memo, not DiaryPhoto.memo
    # If you need to update memo, use the memo endpoints instead
    
    db.commit()
    db.refresh(photo)
    
    # Return photo with memo=None since memo is at DiaryEntry level
    return DiaryPhotoResponse(
        id=photo.id,
        file_path=photo.file_path,
        file_name=photo.file_name,
        memo=None,  # Always None - memo is in DiaryEntry.memo
        order_index=photo.order_index,
        created_at=photo.created_at
    )


@router.delete("/{trip_id}/{date}/photos/{photo_id}")
async def delete_photo(
    trip_id: int,
    date: date,
    photo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a photo. Indexed by trip_id, date, and photo_id."""
    check_trip_access(trip_id, current_user.id, db)
    
    # Get photo and verify it belongs to the specified trip_id and date
    photo = db.query(DiaryPhoto).join(DiaryEntry).filter(
        DiaryPhoto.id == photo_id,
        DiaryEntry.trip_id == trip_id,
        DiaryEntry.date == date
    ).first()
    
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found for this trip_id, date, and photo_id"
        )
    
    # Delete file
    if os.path.exists(photo.file_path):
        os.remove(photo.file_path)
    
    db.delete(photo)
    db.commit()
    
    return {"message": "Photo deleted successfully"}


@router.post("/{trip_id}/{date}/memo", response_model=DiaryEntryResponse, status_code=status.HTTP_201_CREATED)
@router.put("/{trip_id}/{date}/memo", response_model=DiaryEntryResponse)
async def create_or_update_memo(
    trip_id: int,
    date: date,
    memo_data: MemoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add or update daily memo. Indexed by trip_id and date.
    
    POST: Create or update memo
    PUT: Update memo (same as POST, provided for RESTful API convention)
    
    Note: Only one date-based diary entry per user/date. If multiple exist (legacy data),
    uses the oldest one and merges data.
    """
    check_trip_access(trip_id, current_user.id, db)
    
    # Get all date-based diary entries for this date (in case there are duplicates from legacy data)
    diary_entries = db.query(DiaryEntry).options(
        joinedload(DiaryEntry.photos)
    ).filter(
        DiaryEntry.trip_id == trip_id,
        DiaryEntry.user_id == current_user.id,
        DiaryEntry.date == date,
        DiaryEntry.expense_id.is_(None)  # Only get date-based entries, not expense-linked
    ).order_by(DiaryEntry.created_at.asc()).all()  # Get oldest first
    
    if diary_entries:
        # Use the oldest entry (primary entry)
        diary_entry = diary_entries[0]
        
        # If there are multiple entries, merge photos from other entries into the primary one
        if len(diary_entries) > 1:
            # Collect all photos from all entries (before modifying)
            all_photos = []
            for entry in diary_entries:
                db.refresh(entry, ['photos'])  # Ensure photos are loaded
                for photo in entry.photos:
                    all_photos.append(photo)
            
            # Merge memo (use the oldest non-empty memo, or most recent if all have memos)
            if not diary_entry.memo:
                for entry in diary_entries:
                    if entry.memo:
                        diary_entry.memo = entry.memo
                        break
            else:
                # If primary has memo, check if any other entry has a more recent memo
                for entry in diary_entries[1:]:
                    if entry.memo and entry.updated_at > diary_entry.updated_at:
                        diary_entry.memo = entry.memo
            
            # Reorder photos by their original order_index and creation time
            all_photos.sort(key=lambda p: (p.order_index if p.order_index is not None else 999, p.created_at))
            
            # Reassign all photos to primary entry and reorder
            for idx, photo in enumerate(all_photos):
                photo.diary_entry_id = diary_entry.id
                photo.order_index = idx
            
            # Delete duplicate entries (keep only the primary one)
            for entry in diary_entries[1:]:
                db.delete(entry)
            
            db.flush()  # Flush changes before continuing
        
        # Update memo with new value
        diary_entry.memo = memo_data.memo
    else:
        # Create new diary entry
        diary_entry = DiaryEntry(
            trip_id=trip_id,
            user_id=current_user.id,
            date=date,
            memo=memo_data.memo
        )
        db.add(diary_entry)
    
    db.commit()
    
    # Reload with relationships
    diary_entry = db.query(DiaryEntry).options(
        joinedload(DiaryEntry.user),
        joinedload(DiaryEntry.photos)
    ).filter(DiaryEntry.id == diary_entry.id).first()
    
    # Build response
    photo_responses = [
        DiaryPhotoResponse(
            id=p.id,
            file_path=p.file_path,
            file_name=p.file_name,
            memo=None,  # Always None - memo is stored in DiaryEntry.memo
            order_index=p.order_index,
            created_at=p.created_at
        )
        for p in diary_entry.photos
    ]
    
    return DiaryEntryResponse(
        id=diary_entry.id,
        trip_id=diary_entry.trip_id,
        user_id=diary_entry.user_id,
        username=diary_entry.user.username,
        date=diary_entry.date,
        expense_id=diary_entry.expense_id,
        memo=diary_entry.memo,
        photos=photo_responses,
        created_at=diary_entry.created_at,
        updated_at=diary_entry.updated_at
    )


@router.delete("/{trip_id}/{date}/memo")
async def delete_memo(
    trip_id: int,
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete daily memo. Indexed by trip_id and date."""
    check_trip_access(trip_id, current_user.id, db)
    
    # Find date-based diary entry (not expense-linked)
    diary_entry = db.query(DiaryEntry).filter(
        DiaryEntry.trip_id == trip_id,
        DiaryEntry.user_id == current_user.id,
        DiaryEntry.date == date,
        DiaryEntry.expense_id.is_(None)  # Only date-based entries, not expense-linked
    ).first()
    
    if not diary_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diary entry not found for this trip_id and date"
        )
    
    if not diary_entry.memo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No memo found for this trip_id and date"
        )
    
    diary_entry.memo = None
    db.commit()
    
    return {"message": "Memo deleted successfully"}
