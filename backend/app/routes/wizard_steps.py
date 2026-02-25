from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.wizard_session import WizardSession
from app.models.job_posting import JobPosting
from app.models.demand import Demand
from app.models.candidate import Candidate, CandidateApplication
from app.models.onboarding import HclOnboarding, CustomerOnboarding
from sqlalchemy.exc import IntegrityError
from starlette.status import HTTP_404_NOT_FOUND, HTTP_409_CONFLICT
import uuid

router = APIRouter()

@router.post("/session", response_model=dict)
def create_wizard_session(db: Session = Depends(get_db)):
    session = WizardSession()
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "status": session.status, "current_step": session.current_step}

@router.get("/session/{session_id}", response_model=dict)
def get_wizard_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(WizardSession).filter_by(id=session_id, is_deleted=False).first()
    if not session:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Session not found")
    return {"id": session.id, "status": session.status, "current_step": session.current_step}

@router.delete("/session/{session_id}")
def delete_wizard_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(WizardSession).filter_by(id=session_id, is_deleted=False).first()
    if not session:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Session not found")
    session.is_deleted = True
    db.commit()
    return {"ok": True}

# Step 1: Save JobPosting
@router.put("/session/{session_id}/step/1", response_model=dict)
def save_step1(session_id: str, data: dict, db: Session = Depends(get_db)):
    session = db.query(WizardSession).filter_by(id=session_id, is_deleted=False).first()
    if not session:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Session not found")
    if session.current_step < 1:
        raise HTTPException(status_code=400, detail="Cannot save step 1 before session start")
    # Generate UniqueJobPostingId if not set
    if not session.job_posting_unique_id:
        # Call the unique id generator endpoint logic directly
        from app.routes.wizard import generate_unique_job_posting_id
        unique_id_resp = generate_unique_job_posting_id(data["job_posting_id"], db)
        unique_job_posting_id = unique_id_resp["unique_job_posting_id"]
        # Create JobPosting
        job_posting = JobPosting(
            job_posting_id=data["job_posting_id"],
            unique_job_posting_id=unique_job_posting_id,
            portfolio=data.get("portfolio"),
            sub_portfolio=data.get("sub_portfolio"),
            tower=data.get("tower"),
            business_unit=data.get("business_unit"),
            location=data.get("location"),
            sub_location=data.get("sub_location"),
            number_of_positions=data.get("number_of_positions"),
            requirement_type=data.get("requirement_type"),
            customer_job_posting_date=data.get("customer_job_posting_date"),
            job_role=data.get("job_role"),
            skill_category=data.get("skill_category"),
            primary_skills=data.get("primary_skills"),
            secondary_skills=data.get("secondary_skills"),
            customer_cio=data.get("customer_cio"),
            customer_leader=data.get("customer_leader"),
            customer_vice_president=data.get("customer_vice_president"),
        )
        db.add(job_posting)
        session.job_posting_unique_id = unique_job_posting_id
        db.commit()
        db.refresh(session)
        db.refresh(job_posting)
    else:
        # Update JobPosting
        job_posting = db.query(JobPosting).filter_by(unique_job_posting_id=session.job_posting_unique_id).first()
        for field in [
            "portfolio", "sub_portfolio", "tower", "business_unit", "location", "sub_location",
            "number_of_positions", "requirement_type", "customer_job_posting_date", "job_role",
            "skill_category", "primary_skills", "secondary_skills", "customer_cio", "customer_leader", "customer_vice_president"
        ]:
            if field in data:
                setattr(job_posting, field, data[field])
        db.commit()
    session.current_step = max(session.current_step, 1)
    db.commit()
    return {"ok": True, "unique_job_posting_id": session.job_posting_unique_id}


# Step 2: Save Demand
@router.put("/session/{session_id}/step/2", response_model=dict)
def save_step2(session_id: str, data: dict, db: Session = Depends(get_db)):
    session = db.query(WizardSession).filter_by(id=session_id, is_deleted=False).first()
    if not session or session.current_step < 1:
        raise HTTPException(status_code=400, detail="Step 1 must be completed first")
    # Create or update Demand
    demand = None
    if session.demand_id:
        demand = db.query(Demand).filter_by(id=session.demand_id).first()
        for field in [
            "tag_spoc", "tsc_spoc", "demand_id", "demand_created_date", "demand_status", "demand_approved_date",
            "number_of_positions", "tag_first_profile_sourced_date", "tsc_first_profile_sourced_date",
            "tp_profiles_requested", "tp_vendor_name", "tp_profiles_requested_date", "tp_first_profile_sourced_date"
        ]:
            if field in data:
                setattr(demand, field, data[field])
    else:
        demand = Demand(
            job_posting_id=data.get("job_posting_id"),
            unique_job_posting_id=data.get("unique_job_posting_id"),
            tag_spoc=data.get("tag_spoc"),
            tsc_spoc=data.get("tsc_spoc"),
            demand_id=data.get("demand_id"),
            demand_created_date=data.get("demand_created_date"),
            demand_status=data.get("demand_status"),
            demand_approved_date=data.get("demand_approved_date"),
            number_of_positions=data.get("number_of_positions"),
            tag_first_profile_sourced_date=data.get("tag_first_profile_sourced_date"),
            tsc_first_profile_sourced_date=data.get("tsc_first_profile_sourced_date"),
            tp_profiles_requested=data.get("tp_profiles_requested"),
            tp_vendor_name=data.get("tp_vendor_name"),
            tp_profiles_requested_date=data.get("tp_profiles_requested_date"),
            tp_first_profile_sourced_date=data.get("tp_first_profile_sourced_date"),
        )
        db.add(demand)
        db.flush()
        session.demand_id = demand.id
    session.current_step = max(session.current_step, 2)
    db.commit()
    return {"ok": True, "demand_id": session.demand_id}

# Step 3: Save Candidate + Interviews
@router.put("/session/{session_id}/step/3", response_model=dict)
def save_step3(session_id: str, data: dict, db: Session = Depends(get_db)):
    session = db.query(WizardSession).filter_by(id=session_id, is_deleted=False).first()
    if not session or session.current_step < 2:
        raise HTTPException(status_code=400, detail="Step 2 must be completed first")
    # Create or update Candidate and CandidateApplication
    candidate = Candidate(
        name=data.get("candidate_name"),
        contact_number=data.get("candidate_contact_number"),
        email_id=data.get("candidate_email_id"),
    )
    db.add(candidate)
    db.flush()
    application = CandidateApplication(
        candidate_id=candidate.id,
        job_posting_id=data.get("job_posting_id"),
        demand_id=session.demand_id,
        candidate_source_type=data.get("candidate_source_type"),
        tp_vendor_name=data.get("tp_vendor_name"),
        overall_interview_status=data.get("overall_interview_status"),
        initial_screening_status=data.get("initial_screening_status"),
        initial_screening_rejection_reason=data.get("initial_screening_rejection_reason"),
        tp1_interview_status=data.get("tp1_interview_status"),
        tp1_rejection_reason=data.get("tp1_rejection_reason"),
        tp2_interview_status=data.get("tp2_interview_status"),
        tp2_skip_rejection_reason=data.get("tp2_skip_rejection_reason"),
        manager_interview_status=data.get("manager_interview_status"),
        manager_skip_rejection_reason=data.get("manager_skip_rejection_reason"),
        customer_interview_status=data.get("customer_interview_status"),
        customer_interview_skipped_rejected=data.get("customer_interview_skipped_rejected"),
        candidate_selected_date=data.get("candidate_selected_date"),
    )
    db.add(application)
    db.flush()
    session.candidate_application_id = application.id
    session.current_step = max(session.current_step, 3)
    db.commit()
    return {"ok": True, "candidate_application_id": session.candidate_application_id}

# Step 4: Save HCL Onboarding + Employee
@router.put("/session/{session_id}/step/4", response_model=dict)
def save_step4(session_id: str, data: dict, db: Session = Depends(get_db)):
    session = db.query(WizardSession).filter_by(id=session_id, is_deleted=False).first()
    if not session or session.current_step < 3:
        raise HTTPException(status_code=400, detail="Step 3 must be completed first")
    # Create Employee
    from app.models.onboarding import Employee, HclOnboarding
    employee = Employee(
        sap_employee_id=data.get("sap_employee_id"),
        employee_name=data.get("employee_name"),
        employee_contact_number=data.get("employee_contact_number"),
        employee_hcl_email_id=data.get("employee_hcl_email_id"),
    )
    db.add(employee)
    db.flush()
    hcl_onboarding = HclOnboarding(
        job_posting_id=data.get("job_posting_id"),
        unique_job_posting_id=data.get("unique_job_posting_id"),
        demand_id=session.demand_id,
        tag_spoc=data.get("tag_spoc"),
        hcl_fulfillment_spoc=data.get("hcl_fulfillment_spoc"),
        customer_leader=data.get("customer_leader"),
        customer_hiring_manager=data.get("customer_hiring_manager"),
        candidate_name=data.get("candidate_name"),
        candidate_contact_number=data.get("candidate_contact_number"),
        candidate_email_id=data.get("candidate_email_id"),
        hcl_onboarding_status=data.get("hcl_onboarding_status"),
        hire_loss_reason=data.get("hire_loss_reason"),
        onboarded_date=data.get("onboarded_date"),
        employee_id=employee.id,
    )
    db.add(hcl_onboarding)
    db.commit()
    session.current_step = max(session.current_step, 4)
    db.commit()
    return {"ok": True}

# Step 5: Save Customer Onboarding
@router.put("/session/{session_id}/step/5", response_model=dict)
def save_step5(session_id: str, data: dict, db: Session = Depends(get_db)):
    session = db.query(WizardSession).filter_by(id=session_id, is_deleted=False).first()
    if not session or session.current_step < 4:
        raise HTTPException(status_code=400, detail="Step 4 must be completed first")
    from app.models.onboarding import CustomerOnboarding
    customer_onboarding = CustomerOnboarding(
        job_posting_id=data.get("job_posting_id"),
        unique_job_posting_id=data.get("unique_job_posting_id"),
        hcl_fulfillment_spoc=data.get("hcl_fulfillment_spoc"),
        customer_leader=data.get("customer_leader"),
        customer_hiring_manager=data.get("customer_hiring_manager"),
        customer_onboarding_status=data.get("customer_onboarding_status"),
        customer_onboarded_date=data.get("customer_onboarded_date"),
        customer_employee_id=data.get("customer_employee_id"),
        customer_employee_name=data.get("customer_employee_name"),
        customer_email_id=data.get("customer_email_id"),
        customer_login_id=data.get("customer_login_id"),
        customer_line_of_business=data.get("customer_line_of_business"),
        billing_start_date=data.get("billing_start_date"),
        customer_laptop_required=data.get("customer_laptop_required"),
        customer_laptop_status=data.get("customer_laptop_status"),
        customer_laptop_serial_number=data.get("customer_laptop_serial_number"),
    )
    db.add(customer_onboarding)
    session.current_step = max(session.current_step, 5)
    db.commit()
    return {"ok": True}

# Summary endpoint
@router.get("/session/{session_id}/summary", response_model=dict)
def get_summary(session_id: str, db: Session = Depends(get_db)):
    session = db.query(WizardSession).filter_by(id=session_id, is_deleted=False).first()
    if not session:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Session not found")
    # Gather all related data
    job_posting = db.query(JobPosting).filter_by(unique_job_posting_id=session.job_posting_unique_id).first()
    demand = db.query(Demand).filter_by(id=session.demand_id).first() if session.demand_id else None
    application = db.query(CandidateApplication).filter_by(id=session.candidate_application_id).first() if session.candidate_application_id else None
    summary = {
        "job_posting": job_posting.__dict__ if job_posting else None,
        "demand": demand.__dict__ if demand else None,
        "candidate_application": application.__dict__ if application else None,
        # Add more as needed
    }
    return summary

# Submit endpoint
@router.post("/session/{session_id}/submit", response_model=dict)
def submit_wizard(session_id: str, db: Session = Depends(get_db)):
    session = db.query(WizardSession).filter_by(id=session_id, is_deleted=False).first()
    if not session or session.current_step < 5:
        raise HTTPException(status_code=400, detail="All steps must be completed before submit")
    session.status = "Submitted"
    db.commit()
    return {"ok": True, "status": session.status}

# List drafts endpoint
@router.get("/sessions")
def list_drafts(status: str = "Draft", db: Session = Depends(get_db)):
    try:
        # Ensure table exists in the current database; no-op if already present
        WizardSession.__table__.create(bind=db.bind, checkfirst=True)

        sessions = (
            db.query(WizardSession)
            .filter_by(status=status, is_deleted=False)
            .order_by(WizardSession.created_at.desc())
            .all()
        )
        return [
            {
                "id": s.id,
                "status": s.status,
                "current_step": s.current_step,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
            }
            for s in sessions
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"List drafts failed: {exc}")
