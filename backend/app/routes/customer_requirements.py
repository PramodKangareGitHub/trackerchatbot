from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.customer_requirement import CustomerRequirement
from app.models.hcl_demand import HclDemand
from app.models.interviewed_candidate_details import InterviewedCandidateDetails
from app.models.hcl_onboarding_status import HclOnboardingStatus
from app.models.optum_onboarding_status import OptumOnboardingStatus
from app.services.customer_requirement_defaults import (
    DEFAULT_PORTFOLIOS,
    DEFAULT_SUB_PORTFOLIOS,
    DEFAULT_TOWERS,
    DEFAULT_BUSINESS_UNITS,
    DEFAULT_LOCATIONS,
    DEFAULT_SUB_LOCATIONS,
    DEFAULT_REQUIREMENT_TYPES,
    DEFAULT_JOB_ROLES,
    DEFAULT_SKILL_CATEGORIES,
    DEFAULT_JOB_POSTING_STATUSES,
    DEFAULT_CUSTOMER_CIOS,
    DEFAULT_CUSTOMER_LEADERS,
    DEFAULT_CUSTOMER_VPS,
    DEFAULT_CUSTOMER_SENIOR_DIRECTORS,
    DEFAULT_CUSTOMER_DIRECTORS,
    DEFAULT_CUSTOMER_HIRING_MANAGERS,
    DEFAULT_CUSTOMER_BANDS,
    DEFAULT_HCL_LEADERS,
    DEFAULT_HCL_DELIVER_SPOCS,
)

router = APIRouter(prefix="/api/customer-requirements", tags=["customer-requirements"])


class CustomerRequirementIn(BaseModel):
    unique_job_posting_id: str
    portfolio: Optional[str] = None
    sub_portfolio: Optional[str] = None
    tower: Optional[str] = None
    customer_cio: Optional[str] = None
    customer_leader: Optional[str] = None
    customer_vice_president: Optional[str] = None
    customer_senior_director: Optional[str] = None
    customer_director: Optional[str] = None
    customer_hiring_manager: Optional[str] = None
    customer_band: Optional[str] = None
    hcl_leader: Optional[str] = None
    hcl_deliver_spoc: Optional[str] = None
    job_posting_id: Optional[str] = None
    location: Optional[str] = None
    sub_location: Optional[str] = None
    requirement_type: Optional[str] = None
    business_unit: Optional[str] = None
    customer_job_posting_date: Optional[datetime] = None
    number_of_positions: Optional[int] = None
    sell_rate: Optional[float] = None
    job_posting_status: Optional[str] = None
    job_role: Optional[str] = None
    skill_category: Optional[str] = None
    primary_skills: Optional[str] = None
    secondary_skills: Optional[str] = None
    created_by: Optional[str] = None
    modified_by: Optional[str] = None


class CustomerRequirementUpdate(BaseModel):
    unique_job_posting_id: Optional[str] = None
    portfolio: Optional[str] = None
    sub_portfolio: Optional[str] = None
    tower: Optional[str] = None
    customer_cio: Optional[str] = None
    customer_leader: Optional[str] = None
    customer_vice_president: Optional[str] = None
    customer_senior_director: Optional[str] = None
    customer_director: Optional[str] = None
    customer_hiring_manager: Optional[str] = None
    customer_band: Optional[str] = None
    hcl_leader: Optional[str] = None
    hcl_deliver_spoc: Optional[str] = None
    job_posting_id: Optional[str] = None
    location: Optional[str] = None
    sub_location: Optional[str] = None
    requirement_type: Optional[str] = None
    business_unit: Optional[str] = None
    customer_job_posting_date: Optional[datetime] = None
    number_of_positions: Optional[int] = None
    sell_rate: Optional[float] = None
    job_posting_status: Optional[str] = None
    job_role: Optional[str] = None
    skill_category: Optional[str] = None
    primary_skills: Optional[str] = None
    secondary_skills: Optional[str] = None
    created_by: Optional[str] = None
    modified_by: Optional[str] = None


def _serialize_requirement(row: CustomerRequirement) -> dict:
    # Convert ORM row to plain dict with ISO timestamps
    columns = [
        "unique_job_posting_id",
        "portfolio",
        "sub_portfolio",
        "tower",
        "customer_cio",
        "customer_leader",
        "customer_vice_president",
        "customer_senior_director",
        "customer_director",
        "customer_hiring_manager",
        "customer_band",
        "hcl_leader",
        "hcl_deliver_spoc",
        "job_posting_id",
        "location",
        "sub_location",
        "requirement_type",
        "business_unit",
        "customer_job_posting_date",
        "number_of_positions",
        "sell_rate",
        "job_posting_status",
        "job_role",
        "skill_category",
        "primary_skills",
        "secondary_skills",
        "created_at",
        "updated_at",
        "created_by",
        "modified_by",
    ]
    out: dict = {}
    for col in columns:
        val = getattr(row, col, None)
        if isinstance(val, datetime):
            out[col] = val.isoformat()
        else:
            out[col] = val
    return out


@router.post("", status_code=status.HTTP_201_CREATED)
def create_customer_requirements(
    payload: List[CustomerRequirementIn],
    db: Session = Depends(get_db),
) -> dict:
    now = datetime.utcnow()
    records = []
    for item in payload:
        data = item.dict(exclude_unset=True)
        data.setdefault("created_at", now)
        data.setdefault("updated_at", now)
        data.setdefault("created_by", item.created_by or "system")
        data.setdefault("modified_by", item.modified_by or item.created_by or "system")
        records.append(CustomerRequirement(**data))

    try:
        db.bulk_save_objects(records)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate unique_job_posting_id detected",
        ) from exc

    return {"inserted": len(records)}


@router.put("/{unique_job_posting_id}")
def update_customer_requirement(
    unique_job_posting_id: str,
    payload: CustomerRequirementUpdate,
    db: Session = Depends(get_db),
) -> dict:
    row = (
        db.query(CustomerRequirement)
        .filter(CustomerRequirement.unique_job_posting_id == unique_job_posting_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer requirement not found")

    data = payload.dict(exclude_unset=True)
    data["updated_at"] = datetime.utcnow()
    data["modified_by"] = payload.modified_by or data.get("modified_by") or "system"

    # Don't allow primary key changes
    data.pop("unique_job_posting_id", None)

    for key, value in data.items():
        setattr(row, key, value)

    db.add(row)
    db.commit()
    db.refresh(row)
    return {"updated": 1, "record": _serialize_requirement(row)}


@router.get("/portfolios")
def list_portfolios(db: Session = Depends(get_db)) -> dict:
    rows = (
        db.query(CustomerRequirement.portfolio)
        .filter(CustomerRequirement.portfolio.isnot(None))
        .distinct()
        .all()
    )
    db_values = [row[0] for row in rows if row and row[0]]
    merged = sorted({*(value.strip() for value in DEFAULT_PORTFOLIOS), *db_values}, key=str.lower)
    return {"options": merged}


@router.get("/sub-portfolios")
def list_sub_portfolios(db: Session = Depends(get_db)) -> dict:
    rows = (
        db.query(CustomerRequirement.sub_portfolio)
        .filter(CustomerRequirement.sub_portfolio.isnot(None))
        .distinct()
        .all()
    )
    db_values = [row[0] for row in rows if row and row[0]]
    merged = sorted({*(value.strip() for value in DEFAULT_SUB_PORTFOLIOS), *db_values}, key=str.lower)
    return {"options": merged}


@router.get("/next-index")
def get_next_index(
    job_posting_id: str = Query(..., min_length=1, description="Job Posting ID to compute next index for"),
    db: Session = Depends(get_db),
) -> dict:
    existing_count = (
        db.query(CustomerRequirement)
        .filter(CustomerRequirement.job_posting_id == job_posting_id)
        .count()
    )
    next_index = existing_count + 1
    return {"job_posting_id": job_posting_id, "existing_count": existing_count, "next_index": next_index}


@router.get("/defaults")
def list_defaults(db: Session = Depends(get_db)) -> dict:
    portfolio_rows = (
        db.query(CustomerRequirement.portfolio)
        .filter(CustomerRequirement.portfolio.isnot(None))
        .distinct()
        .all()
    )
    sub_portfolio_rows = (
        db.query(CustomerRequirement.sub_portfolio)
        .filter(CustomerRequirement.sub_portfolio.isnot(None))
        .distinct()
        .all()
    )
    tower_rows = (
        db.query(CustomerRequirement.tower)
        .filter(CustomerRequirement.tower.isnot(None))
        .distinct()
        .all()
    )
    business_unit_rows = (
        db.query(CustomerRequirement.business_unit)
        .filter(CustomerRequirement.business_unit.isnot(None))
        .distinct()
        .all()
    )
    location_rows = (
        db.query(CustomerRequirement.location)
        .filter(CustomerRequirement.location.isnot(None))
        .distinct()
        .all()
    )
    sub_location_rows = (
        db.query(CustomerRequirement.sub_location)
        .filter(CustomerRequirement.sub_location.isnot(None))
        .distinct()
        .all()
    )
    requirement_type_rows = (
        db.query(CustomerRequirement.requirement_type)
        .filter(CustomerRequirement.requirement_type.isnot(None))
        .distinct()
        .all()
    )
    job_role_rows = (
        db.query(CustomerRequirement.job_role)
        .filter(CustomerRequirement.job_role.isnot(None))
        .distinct()
        .all()
    )
    skill_category_rows = (
        db.query(CustomerRequirement.skill_category)
        .filter(CustomerRequirement.skill_category.isnot(None))
        .distinct()
        .all()
    )
    job_posting_status_rows = (
        db.query(CustomerRequirement.job_posting_status)
        .filter(CustomerRequirement.job_posting_status.isnot(None))
        .distinct()
        .all()
    )
    customer_cio_rows = (
        db.query(CustomerRequirement.customer_cio)
        .filter(CustomerRequirement.customer_cio.isnot(None))
        .distinct()
        .all()
    )
    customer_leader_rows = (
        db.query(CustomerRequirement.customer_leader)
        .filter(CustomerRequirement.customer_leader.isnot(None))
        .distinct()
        .all()
    )
    customer_vp_rows = (
        db.query(CustomerRequirement.customer_vice_president)
        .filter(CustomerRequirement.customer_vice_president.isnot(None))
        .distinct()
        .all()
    )
    customer_senior_director_rows = (
        db.query(CustomerRequirement.customer_senior_director)
        .filter(CustomerRequirement.customer_senior_director.isnot(None))
        .distinct()
        .all()
    )
    customer_director_rows = (
        db.query(CustomerRequirement.customer_director)
        .filter(CustomerRequirement.customer_director.isnot(None))
        .distinct()
        .all()
    )
    customer_hiring_manager_rows = (
        db.query(CustomerRequirement.customer_hiring_manager)
        .filter(CustomerRequirement.customer_hiring_manager.isnot(None))
        .distinct()
        .all()
    )
    customer_band_rows = (
        db.query(CustomerRequirement.customer_band)
        .filter(CustomerRequirement.customer_band.isnot(None))
        .distinct()
        .all()
    )
    hcl_leader_rows = (
        db.query(CustomerRequirement.hcl_leader)
        .filter(CustomerRequirement.hcl_leader.isnot(None))
        .distinct()
        .all()
    )
    hcl_deliver_spoc_rows = (
        db.query(CustomerRequirement.hcl_deliver_spoc)
        .filter(CustomerRequirement.hcl_deliver_spoc.isnot(None))
        .distinct()
        .all()
    )

    portfolio_db_values = [row[0] for row in portfolio_rows if row and row[0]]
    sub_portfolio_db_values = [row[0] for row in sub_portfolio_rows if row and row[0]]
    tower_db_values = [row[0] for row in tower_rows if row and row[0]]
    business_unit_db_values = [
        row[0] for row in business_unit_rows if row and row[0]
    ]
    location_db_values = [row[0] for row in location_rows if row and row[0]]
    sub_location_db_values = [
        row[0] for row in sub_location_rows if row and row[0]
    ]
    requirement_type_db_values = [
        row[0] for row in requirement_type_rows if row and row[0]
    ]
    job_role_db_values = [row[0] for row in job_role_rows if row and row[0]]
    skill_category_db_values = [
        row[0] for row in skill_category_rows if row and row[0]
    ]
    job_posting_status_db_values = [
        row[0] for row in job_posting_status_rows if row and row[0]
    ]
    customer_cio_db_values = [
        row[0] for row in customer_cio_rows if row and row[0]
    ]
    customer_leader_db_values = [
        row[0] for row in customer_leader_rows if row and row[0]
    ]
    customer_vp_db_values = [
        row[0] for row in customer_vp_rows if row and row[0]
    ]
    customer_senior_director_db_values = [
        row[0] for row in customer_senior_director_rows if row and row[0]
    ]
    customer_director_db_values = [
        row[0] for row in customer_director_rows if row and row[0]
    ]
    customer_hiring_manager_db_values = [
        row[0] for row in customer_hiring_manager_rows if row and row[0]
    ]
    customer_band_db_values = [
        row[0] for row in customer_band_rows if row and row[0]
    ]
    hcl_leader_db_values = [row[0] for row in hcl_leader_rows if row and row[0]]
    hcl_deliver_spoc_db_values = [
        row[0] for row in hcl_deliver_spoc_rows if row and row[0]
    ]

    portfolios = sorted(
        {*(value.strip() for value in DEFAULT_PORTFOLIOS), *portfolio_db_values},
        key=str.lower,
    )
    sub_portfolios = sorted(
        {*(value.strip() for value in DEFAULT_SUB_PORTFOLIOS), *sub_portfolio_db_values},
        key=str.lower,
    )
    towers = sorted(
        {*(value.strip() for value in DEFAULT_TOWERS), *tower_db_values},
        key=str.lower,
    )
    business_units = sorted(
        {*(value.strip() for value in DEFAULT_BUSINESS_UNITS), *business_unit_db_values},
        key=str.lower,
    )
    locations = sorted(
        {*(value.strip() for value in DEFAULT_LOCATIONS), *location_db_values},
        key=str.lower,
    )
    sub_locations = sorted(
        {*(value.strip() for value in DEFAULT_SUB_LOCATIONS), *sub_location_db_values},
        key=str.lower,
    )
    requirement_types = sorted(
        {*(value.strip() for value in DEFAULT_REQUIREMENT_TYPES), *requirement_type_db_values},
        key=str.lower,
    )
    job_roles = sorted(
        {*(value.strip() for value in DEFAULT_JOB_ROLES), *job_role_db_values},
        key=str.lower,
    )
    skill_categories = sorted(
        {*(value.strip() for value in DEFAULT_SKILL_CATEGORIES), *skill_category_db_values},
        key=str.lower,
    )
    job_posting_statuses = sorted(
        {*(value.strip() for value in DEFAULT_JOB_POSTING_STATUSES), *job_posting_status_db_values},
        key=str.lower,
    )
    customer_cios = sorted(
        {*(value.strip() for value in DEFAULT_CUSTOMER_CIOS), *customer_cio_db_values},
        key=str.lower,
    )
    customer_leaders = sorted(
        {*(value.strip() for value in DEFAULT_CUSTOMER_LEADERS), *customer_leader_db_values},
        key=str.lower,
    )
    customer_vps = sorted(
        {*(value.strip() for value in DEFAULT_CUSTOMER_VPS), *customer_vp_db_values},
        key=str.lower,
    )
    customer_senior_directors = sorted(
        {
            *(value.strip() for value in DEFAULT_CUSTOMER_SENIOR_DIRECTORS),
            *customer_senior_director_db_values,
        },
        key=str.lower,
    )
    customer_directors = sorted(
        {
            *(value.strip() for value in DEFAULT_CUSTOMER_DIRECTORS),
            *customer_director_db_values,
        },
        key=str.lower,
    )
    customer_hiring_managers = sorted(
        {
            *(value.strip() for value in DEFAULT_CUSTOMER_HIRING_MANAGERS),
            *customer_hiring_manager_db_values,
        },
        key=str.lower,
    )
    customer_bands = sorted(
        {*(value.strip() for value in DEFAULT_CUSTOMER_BANDS), *customer_band_db_values},
        key=str.lower,
    )
    hcl_leaders = sorted(
        {*(value.strip() for value in DEFAULT_HCL_LEADERS), *hcl_leader_db_values},
        key=str.lower,
    )
    hcl_deliver_spocs = sorted(
        {
            *(value.strip() for value in DEFAULT_HCL_DELIVER_SPOCS),
            *hcl_deliver_spoc_db_values,
        },
        key=str.lower,
    )

    return {
        "portfolios": portfolios,
        "sub_portfolios": sub_portfolios,
        "towers": towers,
        "business_units": business_units,
        "locations": locations,
        "sub_locations": sub_locations,
        "requirement_types": requirement_types,
        "job_roles": job_roles,
        "skill_categories": skill_categories,
        "job_posting_statuses": job_posting_statuses,
        "customer_cios": customer_cios,
        "customer_leaders": customer_leaders,
        "customer_vps": customer_vps,
        "customer_senior_directors": customer_senior_directors,
        "customer_directors": customer_directors,
        "customer_hiring_managers": customer_hiring_managers,
        "customer_bands": customer_bands,
        "hcl_leaders": hcl_leaders,
        "hcl_deliver_spocs": hcl_deliver_spocs,
    }


@router.get("/report")
def report_customer_requirements(db: Session = Depends(get_db)) -> dict:
    columns = [
        "unique_job_posting_id",
        "portfolio",
        "sub_portfolio",
        "tower",
        "customer_cio",
        "customer_leader",
        "customer_vice_president",
        "customer_senior_director",
        "customer_director",
        "customer_hiring_manager",
        "customer_band",
        "hcl_leader",
        "hcl_deliver_spoc",
        "job_posting_id",
        "location",
        "sub_location",
        "requirement_type",
        "business_unit",
        "customer_job_posting_date",
        "number_of_positions",
        "sell_rate",
        "job_posting_status",
        "job_role",
        "skill_category",
        "primary_skills",
        "secondary_skills",
        "created_at",
        "updated_at",
        "created_by",
        "modified_by",
    ]

    rows = db.query(CustomerRequirement).all()
    serialized = [_serialize_requirement(row) for row in rows]
    return {"columns": columns, "rows": serialized}


@router.delete("/{unique_job_posting_id}")
def delete_job_posting(unique_job_posting_id: str, db: Session = Depends(get_db)) -> dict:
    exists = (
        db.query(CustomerRequirement.unique_job_posting_id)
        .filter(CustomerRequirement.unique_job_posting_id == unique_job_posting_id)
        .first()
    )
    if not exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer requirement not found")

    optum_deleted = (
        db.query(OptumOnboardingStatus)
        .filter(OptumOnboardingStatus.unique_job_posting_id == unique_job_posting_id)
        .delete(synchronize_session=False)
    )

    hcl_onboarding_deleted = (
        db.query(HclOnboardingStatus)
        .filter(HclOnboardingStatus.unique_job_posting_id == unique_job_posting_id)
        .delete(synchronize_session=False)
    )

    candidate_deleted = (
        db.query(InterviewedCandidateDetails)
        .filter(InterviewedCandidateDetails.unique_job_posting_id == unique_job_posting_id)
        .delete(synchronize_session=False)
    )

    hcl_demand_deleted = (
        db.query(HclDemand)
        .filter(HclDemand.unique_job_posting_id == unique_job_posting_id)
        .delete(synchronize_session=False)
    )

    customer_deleted = (
        db.query(CustomerRequirement)
        .filter(CustomerRequirement.unique_job_posting_id == unique_job_posting_id)
        .delete(synchronize_session=False)
    )

    db.commit()

    return {
        "deleted": {
            "optum_onboarding": optum_deleted,
            "hcl_onboarding": hcl_onboarding_deleted,
            "interviewed_candidates": candidate_deleted,
            "hcl_demand": hcl_demand_deleted,
            "customer_requirement": customer_deleted,
        }
    }
