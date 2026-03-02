# SmartChat Excel

Project stack

- Frontend: Vite + React + TypeScript + Tailwind
- Backend: FastAPI + SQLite + pandas/openpyxl + LangChain

Prerequisites

- Node.js 18+
- Python 3.10+

Setup

1. Backend
   - cd backend
   - python -m venv .venv && source .venv/Scripts/activate (PowerShell: .venv\Scripts\Activate)
   - pip install -r requirements.txt
   - Start backend (uvicorn): uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

2. Frontend
   - cd frontend
   - npm install
   - npm run dev

API notes

- Upload & preview: POST /api/upload, GET /api/datasets/{id}/preview
- Chat: POST /api/chat (returns needs_filter or ready with sql/results)
- Admin: dashboard config, dataset list/delete, record append under /api/admin/\*

Environment

- DATABASE_URL (optional; defaults to sqlite:///./app.db inside backend/)
- INTENT_MODEL, INTENT_MODEL_TEMPERATURE for LangChain model selection
- USE_AI_CAFE=true to route intent generation to AI Cafe
- AI_CAFE_ENDPOINT, AI_CAFE_API_KEY required when USE_AI_CAFE is true (optional: AI_CAFE_MODEL, AI_CAFE_MAX_TOKENS)

Development tips

- Keep backend and frontend running separately.
- Theme and admin/viewer mode toggles live in the UI header.

Database reset & migrations (from backend/)

- Activate venv: `.venv\Scripts\Activate.ps1` (PowerShell) or `source .venv/bin/activate` (bash)
- Optional fresh start: `Remove-Item app.db -Force` (PowerShell) or `rm app.db` (bash)
- Apply schema: `.venv\Scripts\python -m alembic upgrade head` (or `alembic upgrade head` if alembic is on PATH)
- If models change later: `alembic revision -m "describe change"` then edit the generated file (autogenerate is not wired) and run `alembic upgrade head`
