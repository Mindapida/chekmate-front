"""
Expense management routes.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from typing import List, Optional
from datetime import date
from decimal import Decimal

logger = logging.getLogger(__name__)
from app.db.session import get_db
from app.models.user import User
from app.models.trip import Trip, TripParticipant
from app.models.expense import Expense, ExpenseParticipant
from app.schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseUpdate, OCRExpensePreview, ExpenseParticipantResponse, CategorySummaryResponse, CategoryExpenseItem
from app.api.dependencies import get_current_user
from app.api.routes.trips import check_trip_access

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("/{trip_id}/{date}", response_model=List[ExpenseResponse])
async def get_expenses_by_date(
    trip_id: int,
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get expenses for a specific date."""
    check_trip_access(trip_id, current_user.id, db)
    
    # Load expenses with relationships
    expenses = db.query(Expense).options(
        joinedload(Expense.payer),
        joinedload(Expense.participants).joinedload(ExpenseParticipant.user)
    ).filter(
        Expense.trip_id == trip_id,
        Expense.date == date
    ).all()
    
    # Sort expenses: if time exists, sort by time (ascending), else by display_order (ascending)
    # Group expenses by whether they have time or not, then sort within each group
    expenses_with_time = [e for e in expenses if e.time is not None]
    expenses_without_time = [e for e in expenses if e.time is None]
    
    # Sort expenses with time by time (ascending)
    expenses_with_time.sort(key=lambda e: (e.time, e.display_order, e.id))
    # Sort expenses without time by display_order (ascending)
    expenses_without_time.sort(key=lambda e: (e.display_order, e.id))
    
    # Combine: expenses with time first (sorted by time), then expenses without time (sorted by display_order)
    expenses = expenses_with_time + expenses_without_time
    
    # Get trip's base currency
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    base_currency = trip.base_currency if trip and hasattr(trip, 'base_currency') else "KRW"
    
    # Build response list
    expense_responses = []
    for expense in expenses:
        participant_responses = []
        for ep in expense.participants:
            participant_responses.append(ExpenseParticipantResponse(
                user_id=ep.user_id,
                username=ep.user.username,
                share_amount_base=ep.share_amount_base,
                base_currency=base_currency
            ))
        
        expense_responses.append(ExpenseResponse(
            id=expense.id,
            trip_id=expense.trip_id,
            payer_id=expense.payer_id,
            payer_username=expense.payer.username,
            date=expense.date,
            time=expense.time,
            amount=expense.amount,
            currency=expense.currency,
            amount_base=expense.amount_base,
            base_currency=base_currency,
            description=expense.description,
            category=expense.category,
            display_order=getattr(expense, 'display_order', expense.id),
            participants=participant_responses,
            created_at=expense.created_at,
            updated_at=expense.updated_at
        ))
    
    return expense_responses


@router.post("/{trip_id}/{date}", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    trip_id: int,
    date: date,
    expense_data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new expense manually."""
    check_trip_access(trip_id, current_user.id, db)
    
    # Use date from body if provided, otherwise use path parameter
    # This allows validation while maintaining RESTful URL structure
    expense_date = expense_data.date if expense_data.date else date
    
    # Get trip information for context
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )
    
    # Get exchange rate and convert to trip's base currency
    from app.services.fx_service import get_exchange_rate, convert_to_base
    rate = get_exchange_rate(trip_id, expense_date, expense_data.currency, db)
    amount_base = convert_to_base(expense_data.amount, expense_data.currency, rate, base_currency=trip.base_currency)
    
    trip_name = trip.name
    
    # Auto-classify category if not provided
    category = expense_data.category.lower() if expense_data.category else None
    if not category and expense_data.description:
        from app.services.category_service import classify_expense_category
        category = await classify_expense_category(
            description=expense_data.description,
            trip_name=trip_name,
            amount=float(expense_data.amount),
            currency=expense_data.currency
        )
    
    # Get the count of expenses for this date
    # For manual addition, set display_order to count + 1 (will appear at bottom when sorted ASC)
    expense_count = db.query(func.count(Expense.id)).filter(
        Expense.trip_id == trip_id,
        Expense.date == expense_date
    ).scalar() or 0
    
    # Set display_order to count + 1 (1-indexed, so new expense gets order = count + 1)
    # Since we sort ASC, higher order = appears at bottom
    display_order = expense_count + 1
    
    # Create expense
    new_expense = Expense(
        trip_id=trip_id,
        payer_id=current_user.id,
        date=expense_date,
        time=expense_data.time,
        amount=expense_data.amount,
        currency=expense_data.currency,
        amount_base=amount_base,
        description=expense_data.description,
        category=category,
        display_order=display_order
    )
    db.add(new_expense)
    db.flush()
    
    # Add participants
    if expense_data.participant_ids:
        share_per_person = Decimal(int(round(amount_base / len(expense_data.participant_ids))))
    else:
        share_per_person = amount_base
    for user_id in expense_data.participant_ids:
        participant = ExpenseParticipant(
            expense_id=new_expense.id,
            user_id=user_id,
            share_amount_base=share_per_person
        )
        db.add(participant)
    
    db.commit()
    
    # Reload expense with relationships
    expense = db.query(Expense).options(
        joinedload(Expense.payer),
        joinedload(Expense.participants).joinedload(ExpenseParticipant.user)
    ).filter(Expense.id == new_expense.id).first()
    
    # Build response with proper participant data
    base_currency = trip.base_currency if trip and hasattr(trip, 'base_currency') else "KRW"
    participant_responses = []
    for ep in expense.participants:
        participant_responses.append(ExpenseParticipantResponse(
            user_id=ep.user_id,
            username=ep.user.username,
            share_amount_base=ep.share_amount_base,
            base_currency=base_currency
        ))
    
    # Build expense response
    expense_response = ExpenseResponse(
        id=expense.id,
        trip_id=expense.trip_id,
        payer_id=expense.payer_id,
        payer_username=expense.payer.username,
        date=expense.date,
        time=expense.time,
        amount=expense.amount,
        currency=expense.currency,
        amount_base=expense.amount_base,
        base_currency=base_currency,
        description=expense.description,
        category=expense.category,
        display_order=getattr(expense, 'display_order', expense.id),
        participants=participant_responses,
        created_at=expense.created_at,
        updated_at=expense.updated_at
    )
    
    return expense_response


@router.post("/{trip_id}/{date}/ocr", response_model=List[OCRExpensePreview])
async def upload_expense_ocr_preview(
    trip_id: int,
    date: date,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload image for OCR parsing and return preview of ALL expenses found (does not save expenses)."""
    check_trip_access(trip_id, current_user.id, db)
    
    from app.services.ocr_service import parse_expense_image
    ocr_results = await parse_expense_image(file, trip_id, db, target_date=date)
    
    # Set date from URL parameter for all results
    results = []
    for ocr_result in ocr_results:
        result = OCRExpensePreview(
            amount=ocr_result.amount,
            currency=ocr_result.currency,
            description=ocr_result.description,
            time=getattr(ocr_result, 'time', None),  # Include time if extracted
            date=date  # Always use URL date parameter
        )
        results.append(result)
    
    return results


@router.post("/{trip_id}/{date}/ocr/create", response_model=List[ExpenseResponse], status_code=status.HTTP_201_CREATED)
async def upload_expense_ocr_and_create(
    trip_id: int,
    date: date,
    file: UploadFile = File(...),
    participant_ids: Optional[str] = Form(None),  # Comma-separated list of user IDs, e.g., "1,2,3"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload image for OCR parsing and immediately create ALL expenses found in the image.
    Uses OCR results to populate expense fields, then creates expenses with participants.
    
    Date logic: Always uses URL date parameter for all expenses.
    """
    check_trip_access(trip_id, current_user.id, db)
    
    # Parse OCR image (does not parse date - only amount, currency, description)
    # Pass target_date to filter payments matching the URL date
    from app.services.ocr_service import parse_expense_image
    ocr_results = await parse_expense_image(file, trip_id, db, target_date=date)
    
    # Always use URL date parameter (not parsed from OCR to maintain payment order)
    expense_date = date
    
    # Parse participant_ids (comma-separated string or list)
    participant_id_list = []
    if participant_ids:
        if isinstance(participant_ids, str):
            participant_id_list = [int(uid.strip()) for uid in participant_ids.split(",") if uid.strip()]
        else:
            participant_id_list = participant_ids
    
    # If no participants specified, use current user only
    if not participant_id_list:
        participant_id_list = [current_user.id]
    
    # Validate participants are trip members
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )
    
    trip_participant_ids = {p.user_id for p in trip.participants}
    for user_id in participant_id_list:
        if user_id not in trip_participant_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User {user_id} is not a participant of this trip"
            )
    
    # Create expenses for each OCR result
    # OCR results are in top-to-bottom order (first = top of image)
    # We assign display_order so that top expenses get SMALLER order (will appear first when sorted ASC)
    expense_responses = []
    from app.services.fx_service import get_exchange_rate, convert_to_base
    from app.services.category_service import classify_expense_category
    
    # Get current max order for this date (to continue numbering)
    max_order = db.query(func.max(Expense.display_order)).filter(
        Expense.trip_id == trip_id,
        Expense.date == expense_date
    ).scalar() or 0  # Start from 0, then add 1 for first expense
    
    # Process OCR results in order (first = top of image)
    # Assign orders so top expense gets smallest order (1, 2, 3...)
    num_expenses = len(ocr_results)
    for idx, ocr_result in enumerate(ocr_results):
        amount = ocr_result.amount if ocr_result.amount else Decimal(0)
        currency = ocr_result.currency if ocr_result.currency else "KRW"
        description = ocr_result.description
        expense_time = getattr(ocr_result, 'time', None)
        
        # Skip if amount is invalid
        if amount <= 0:
            logger.warning(f"Skipping expense with invalid amount: {amount}")
            continue
        
        # Use same logic as manual expense creation
        rate = get_exchange_rate(trip_id, expense_date, currency, db)
        amount_base = convert_to_base(amount, currency, rate, base_currency=trip.base_currency)
        
        # Auto-classify category based on description, trip context, and amount
        category = await classify_expense_category(
            description=description,
            trip_name=trip.name if trip else None,
            amount=float(amount),
            currency=currency
        )
        
        # Assign display_order: top expense (idx=0) gets smallest order, bottom expense gets larger order
        # This ensures top-to-bottom ordering when sorted ascending (1, 2, 3...)
        display_order = max_order + idx + 1  # First expense (top) gets order = max_order + 1
        
        # Create expense
        new_expense = Expense(
            trip_id=trip_id,
            payer_id=current_user.id,
            date=expense_date,
            time=expense_time,
            amount=amount,
            currency=currency,
            amount_base=amount_base,
            description=description,
            category=category,
            display_order=display_order
        )
        db.add(new_expense)
        db.flush()
        
        # Add participants
        if participant_id_list:
            share_per_person = Decimal(int(round(amount_base / len(participant_id_list))))
        else:
            share_per_person = amount_base
        for user_id in participant_id_list:
            participant = ExpenseParticipant(
                expense_id=new_expense.id,
                user_id=user_id,
                share_amount_base=share_per_person
            )
            db.add(participant)
        
        db.flush()  # Flush to get the expense ID
        
        # Reload expense with relationships
        expense = db.query(Expense).options(
            joinedload(Expense.payer),
            joinedload(Expense.participants).joinedload(ExpenseParticipant.user)
        ).filter(Expense.id == new_expense.id).first()
        
        # Build response
        base_currency = trip.base_currency if trip and hasattr(trip, 'base_currency') else "KRW"
        participant_responses = []
        for ep in expense.participants:
            participant_responses.append(ExpenseParticipantResponse(
                user_id=ep.user_id,
                username=ep.user.username,
                share_amount_base=ep.share_amount_base,
                base_currency=base_currency
            ))
        
        expense_response = ExpenseResponse(
            id=expense.id,
            trip_id=expense.trip_id,
            payer_id=expense.payer_id,
            payer_username=expense.payer.username,
            date=expense.date,
            time=expense.time,
            amount=expense.amount,
            currency=expense.currency,
            amount_base=expense.amount_base,
            base_currency=base_currency,
            description=expense.description,
            category=expense.category,
            display_order=getattr(expense, 'display_order', expense.id),
            participants=participant_responses,
            created_at=expense.created_at,
            updated_at=expense.updated_at
        )
        expense_responses.append(expense_response)
    
    # Commit all expenses at once
    db.commit()
    
    return expense_responses


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_data: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an expense."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    check_trip_access(expense.trip_id, current_user.id, db)
    
    # Update fields
    if expense_data.time is not None:
        expense.time = expense_data.time
    if expense_data.amount is not None:
        expense.amount = expense_data.amount
    if expense_data.currency is not None:
        expense.currency = expense_data.currency
    if expense_data.description is not None:
        expense.description = expense_data.description
    if expense_data.category is not None:
        expense.category = expense_data.category.lower() if expense_data.category else None
    if expense_data.display_order is not None:
        expense.display_order = expense_data.display_order
    
    # Recalculate KRW amount if amount or currency changed
    amount_or_currency_changed = False
    if expense_data.amount is not None or expense_data.currency is not None:
        from app.services.fx_service import get_exchange_rate, convert_to_base
        rate = get_exchange_rate(expense.trip_id, expense.date, expense.currency, db)
        # Get trip to access base_currency
        trip_for_expense = db.query(Trip).filter(Trip.id == expense.trip_id).first()
        base_currency = trip_for_expense.base_currency if trip_for_expense else "KRW"
        expense.amount_base = convert_to_base(expense.amount, expense.currency, rate, base_currency=base_currency)
        amount_or_currency_changed = True
    
    # Update participants if provided
    if expense_data.participant_ids is not None:
        # Delete existing participants
        db.query(ExpenseParticipant).filter(
            ExpenseParticipant.expense_id == expense_id
        ).delete()
        
        # Add new participants
        if expense_data.participant_ids:
            share_per_person = Decimal(int(round(expense.amount_base / len(expense_data.participant_ids))))
        else:
            share_per_person = expense.amount_base
        for user_id in expense_data.participant_ids:
            participant = ExpenseParticipant(
                expense_id=expense_id,
                user_id=user_id,
                share_amount_base=share_per_person
            )
            db.add(participant)
    elif amount_or_currency_changed:
        # If amount/currency changed but participants weren't updated, recalculate existing shares
        existing_participants = db.query(ExpenseParticipant).filter(
            ExpenseParticipant.expense_id == expense_id
        ).all()
        
        if existing_participants:
            # Recalculate share per person based on new amount_base
            share_per_person = Decimal(int(round(expense.amount_base / len(existing_participants))))
            for participant in existing_participants:
                participant.share_amount_base = share_per_person
    
    db.commit()
    
    # Reload expense with relationships
    updated_expense = db.query(Expense).options(
        joinedload(Expense.payer),
        joinedload(Expense.participants).joinedload(ExpenseParticipant.user)
    ).filter(Expense.id == expense_id).first()
    
    # Get trip's base currency
    trip_for_response = db.query(Trip).filter(Trip.id == updated_expense.trip_id).first()
    base_currency = trip_for_response.base_currency if trip_for_response and hasattr(trip_for_response, 'base_currency') else "KRW"
    
    # Build response with proper participant data
    participant_responses = []
    for ep in updated_expense.participants:
        participant_responses.append(ExpenseParticipantResponse(
            user_id=ep.user_id,
            username=ep.user.username,
            share_amount_base=ep.share_amount_base,
            base_currency=base_currency
        ))
    
    # Build expense response
    expense_response = ExpenseResponse(
        id=updated_expense.id,
        trip_id=updated_expense.trip_id,
        payer_id=updated_expense.payer_id,
        payer_username=updated_expense.payer.username,
        date=updated_expense.date,
        time=updated_expense.time,
        amount=updated_expense.amount,
        currency=updated_expense.currency,
        amount_base=updated_expense.amount_base,
        base_currency=base_currency,
        description=updated_expense.description,
        category=updated_expense.category,
        display_order=getattr(updated_expense, 'display_order', updated_expense.id),
        participants=participant_responses,
        created_at=updated_expense.created_at,
        updated_at=updated_expense.updated_at
    )
    
    return expense_response


@router.put("/{trip_id}/{date}/reorder", response_model=List[ExpenseResponse])
async def reorder_expenses(
    trip_id: int,
    date: date,
    expense_ids: List[int],  # Ordered list of expense IDs
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reorder expenses for a specific date.
    The expense_ids list should contain all expense IDs for that date in the desired order.
    """
    check_trip_access(trip_id, current_user.id, db)
    
    # Get all expenses for this date
    expenses = db.query(Expense).filter(
        Expense.trip_id == trip_id,
        Expense.date == date
    ).all()
    
    # Validate that all provided expense IDs exist and belong to this trip/date
    expense_dict = {exp.id: exp for exp in expenses}
    if len(expense_ids) != len(expense_dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Number of expense IDs ({len(expense_ids)}) doesn't match number of expenses for this date ({len(expense_dict)})"
        )
    
    for expense_id in expense_ids:
        if expense_id not in expense_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Expense {expense_id} not found or doesn't belong to this trip/date"
            )
    
    # Update display_order based on the provided order (1-indexed: 1, 2, 3...)
    for idx, expense_id in enumerate(expense_ids):
        expense_dict[expense_id].display_order = idx + 1  # Start from 1, not 0
    
    db.commit()
    
    # Reload expenses with relationships
    expenses = db.query(Expense).options(
        joinedload(Expense.payer),
        joinedload(Expense.participants).joinedload(ExpenseParticipant.user)
    ).filter(
        Expense.trip_id == trip_id,
        Expense.date == date
    ).all()
    
    # Sort expenses: if time exists, sort by time (ascending), else by display_order (ascending)
    # Group expenses by whether they have time or not, then sort within each group
    expenses_with_time = [e for e in expenses if e.time is not None]
    expenses_without_time = [e for e in expenses if e.time is None]
    
    # Sort expenses with time by time (ascending)
    expenses_with_time.sort(key=lambda e: (e.time, e.display_order, e.id))
    # Sort expenses without time by display_order (ascending)
    expenses_without_time.sort(key=lambda e: (e.display_order, e.id))
    
    # Combine: expenses with time first (sorted by time), then expenses without time (sorted by display_order)
    expenses = expenses_with_time + expenses_without_time
    
    # Get trip's base currency
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    base_currency = trip.base_currency if trip and hasattr(trip, 'base_currency') else "KRW"
    
    # Build response
    expense_responses = []
    for expense in expenses:
        participant_responses = []
        for ep in expense.participants:
            participant_responses.append(ExpenseParticipantResponse(
                user_id=ep.user_id,
                username=ep.user.username,
                share_amount_base=ep.share_amount_base,
                base_currency=base_currency
            ))
        
        expense_responses.append(ExpenseResponse(
            id=expense.id,
            trip_id=expense.trip_id,
            payer_id=expense.payer_id,
            payer_username=expense.payer.username,
            date=expense.date,
            time=expense.time,
            amount=expense.amount,
            currency=expense.currency,
            amount_base=expense.amount_base,
            base_currency=base_currency,
            description=expense.description,
            category=expense.category,
            display_order=getattr(expense, 'display_order', expense.id),
            participants=participant_responses,
            created_at=expense.created_at,
            updated_at=expense.updated_at
        ))
    
    return expense_responses


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an expense."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    check_trip_access(expense.trip_id, current_user.id, db)
    
    db.delete(expense)
    db.commit()
    
    return {"message": "Expense deleted successfully"}


@router.get("/{trip_id}/category-summary", response_model=CategorySummaryResponse)
async def get_category_summary(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get expense summary by category for a trip.
    Returns total amount spent in each category.
    """
    check_trip_access(trip_id, current_user.id, db)
    
    # Get trip to access base currency
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )
    
    base_currency = trip.base_currency if trip and hasattr(trip, 'base_currency') else "KRW"
    
    # Get all expenses for this trip
    expenses = db.query(Expense).filter(Expense.trip_id == trip_id).all()
    
    # Calculate total expenses
    total_expenses = sum(exp.amount_base for exp in expenses)
    
    # Group expenses by category
    category_totals = {}
    category_counts = {}
    uncategorized_total = Decimal(0)
    uncategorized_count = 0
    
    for expense in expenses:
        category = expense.category if expense.category else "uncategorized"
        
        if category == "uncategorized" or not category:
            uncategorized_total += expense.amount_base
            uncategorized_count += 1
        else:
            if category not in category_totals:
                category_totals[category] = Decimal(0)
                category_counts[category] = 0
            category_totals[category] += expense.amount_base
            category_counts[category] += 1
    
    # Build category items with percentage
    category_items = []
    for category, total_amount in category_totals.items():
        percentage = float((total_amount / total_expenses * 100) if total_expenses > 0 else 0)
        category_items.append(CategoryExpenseItem(
            category=category,
            total_amount_base=total_amount,
            expense_count=category_counts[category],
            percentage=percentage
        ))
    
    # Sort by total amount (descending)
    category_items.sort(key=lambda x: x.total_amount_base, reverse=True)
    
    return CategorySummaryResponse(
        trip_id=trip_id,
        base_currency=base_currency,
        total_expenses_base=total_expenses,
        categories=category_items,
        uncategorized_amount_base=uncategorized_total,
        uncategorized_count=uncategorized_count
    )

