# AI-Powered File Organizer

A local web app that organizes uploaded files into smart folders, removes exact duplicates, and lets you search files by meaning. It has a FastAPI backend (SQLite + ChromaDB) and a React + Vite frontend. Embeddings come from a local Ollama model when available, with a keyword fallback otherwise.

## Requirements

- Python 3.10+
- Node.js 18+ and npm
- Optional: [Ollama](https://ollama.com) with `nomic-embed-text` for semantic search (`ollama pull nomic-embed-text`)
- Optional: a Gmail account with an App Password for sending login and verification emails

## 1. Configure

Copy the template and fill in your values:

```bash
cp .env.example .env           # project root
```

Key settings:

| Variable | Purpose |
|---|---|
| `SMTP_USER`, `SMTP_PASSWORD` | Gmail sender and 16-character App Password. Required for sign-up and login codes. |
| `FRONTEND_URL` | Base URL used in verification links (default `http://localhost:5173`). |
| `MAX_UPLOAD_MB` | Per-file upload limit in MB (default `100`). |
| `COOKIE_SECURE` | Set to `true` when served over HTTPS so the session cookie is HTTPS-only. |
| `SESSION_IDLE_MINUTES` | Sign-out after this many idle minutes on the server (default `30`). |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Optional. Creates the first admin on startup if no admin exists. Use an inbox you control, since admin sign-in requires an emailed code. |
| `OLLAMA_BASE_URL`, `DEFAULT_EMBED_MODEL` | Ollama endpoint and embedding model. |

No default accounts are created. If you want an admin, set both `SEED_ADMIN_*` variables before the first start.

## 2. Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate    macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

API docs are at http://127.0.0.1:8000/docs.

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the backend on port 8000.

**Windows shortcut:** after creating `backend/venv` and running `npm install`, `start_all.bat` starts both servers.

## Tests

From the project root:

```bash
pip install -r backend/requirements-dev.txt
pytest
```

The tests use mocked email delivery, so no SMTP account is needed.

## Data and storage

- `backend/uploads/`: stored files
- `backend/file_registry.db`: SQLite metadata and accounts
- `backend/chroma_data/`: vector index
- `backend/batch_vault/`: temporary batch-organizer output

These paths are git-ignored. Deleting `file_registry.db` and `chroma_data/` resets the app.

## Notes

- Sign-in is two-step: password, then a 6-digit code emailed to the account. Login codes are rate-limited (one per minute, three per 15 minutes).
- Only admins can list accounts and use "Clear all data".
- Duplicate cleanup never removes the last copy of a file.
