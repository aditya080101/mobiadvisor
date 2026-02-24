# Agents.md — MobiAdvisor

> Guidelines for AI agents working in this repository.

---

## Project Overview

**MobiAdvisor** is an AI-powered mobile phone shopping assistant for the Indian market. Users can search, compare, and get recommendations for 140+ phones through a chat interface, a browse/filter grid, and a side-by-side comparison tab.

| Layer | Stack |
|-------|-------|
| **Backend** | Python 3.11+, Django 5, Django REST Framework |
| **AI Agent** | LangChain 0.3, LangGraph 0.2, OpenAI GPT-4o-mini |
| **Frontend** | React 18, TypeScript, Tailwind CSS 3, Create React App |
| **Database** | SQLite (file: `backend/data/mobiles_india.db`) |
| **Vector Search** | Pinecone (optional) |

### Repository Layout

```
├── backend/                    # Django REST API
│   ├── config/                 # Django settings, root URL conf, WSGI
│   ├── api/                    # Models, views, serializers, management commands
│   │   ├── models.py           # Phone model (single model, 140+ rows)
│   │   ├── views.py            # ChatView, CompareView, PhoneListView, PhoneDetailView, FiltersView
│   │   ├── serializers.py      # DRF serializers for request/response
│   │   └── management/commands/import_phones.py  # CSV → DB importer
│   ├── ai/                     # LangChain / LangGraph AI modules
│   │   ├── graph.py            # LangGraph state machine (agent workflow)
│   │   ├── tools.py            # 7 grounded LangChain tools
│   │   ├── guardrails.py       # InputGuardrail, OutputGuardrail, FactChecker
│   │   ├── schemas.py          # Pydantic models for structured output
│   │   ├── prompts.py          # System prompt templates
│   │   ├── llm_client.py       # OpenAI LLM wrapper
│   │   ├── query_processor.py  # Query classification & multi-query handling
│   │   └── vector_client.py    # Pinecone vector search client
│   ├── data/                   # SQLite DB + CSV source
│   └── requirements.txt
│
├── frontend/                   # React + TypeScript SPA
│   ├── src/
│   │   ├── App.tsx             # Root component (tabs: Chat, Browse, Compare)
│   │   ├── api/                # API client functions (fetch wrappers)
│   │   ├── components/
│   │   │   ├── chat/           # ChatContainer, ChatMessage, ChatInput
│   │   │   ├── browse/         # BrowseTab, FilterPanel
│   │   │   ├── compare/        # CompareTab
│   │   │   ├── phone/          # PhoneCard
│   │   │   └── ui/             # Reusable primitives (Button, etc.)
│   │   ├── types/              # TypeScript interfaces
│   │   └── lib/                # Utility functions (cn, etc.)
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── data/                       # Root-level phone dataset (CSV + DB copies)
└── .env.local                  # Root env file (DO NOT COMMIT real keys)
```

---

## Build & Run Commands

### Backend

```bash
cd backend

# 1. Create & activate virtual environment
python -m venv venv
.\venv\Scripts\activate          # Windows
source venv/bin/activate         # Linux / macOS

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up environment variables
cp .env.example .env
# Then edit .env — at minimum set OPENAI_API_KEY

# 4. Import phone data from CSV into SQLite
python manage.py import_phones --clear

# 5. Run migrations (if any new model changes)
python manage.py migrate

# 6. Start the dev server
python manage.py runserver       # → http://localhost:8000
```

### Frontend

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start the dev server (proxies API calls to :8000)
npm start                        # → http://localhost:3000

# 3. Production build
npm run build
```

### Running Both Together

Start the backend first (port 8000), then the frontend (port 3000). The frontend `package.json` has `"proxy": "http://localhost:8000"` configured, so API calls are proxied automatically during development.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | **Yes** | OpenAI API key for LLM + embeddings |
| `OPENAI_MODEL` | No | Model name (default: `gpt-4o-mini`) |
| `OPENAI_EMBEDDING_MODEL` | No | Embedding model (default: `text-embedding-3-small`) |
| `PINECONE_API_KEY` | No | Pinecone API key for vector search |
| `PINECONE_INDEX_NAME` | No | Pinecone index (default: `phone-shopping-agent`) |
| `SECRET_KEY` | No | Django secret key (has dev default) |
| `DEBUG` | No | `True` / `False` (default: `True`) |


> [!CAUTION]
> Never commit real API keys. The `.gitignore` excludes `.env` and `.env.*` (except `.env.example`). If you see keys in committed files, rotate them immediately.

---

## Code Style Guidelines

### Python (Backend)

- **Framework conventions**: Follow Django and DRF idioms. Views inherit from `APIView`. Serializers handle request/response validation.
- **Type hints**: Use Python typing throughout (see `ai/schemas.py` for Pydantic models, `ai/graph.py` for `TypedDict` state).
- **Imports**: Group as standard library → third-party → Django → local (relative imports within the same app).
- **Naming**: `snake_case` for functions/variables, `PascalCase` for classes. Constants in `UPPER_SNAKE_CASE`.
- **Singletons**: The AI modules use singleton patterns for expensive objects (`_agent`, `input_guardrail`, `output_guardrail`, `fact_checker`). Preserve this pattern.

### TypeScript / React (Frontend)

- **Components**: Functional components with hooks. No class components.
- **File structure**: One component per file, co-located with its feature directory (`components/chat/`, `components/browse/`, etc.).
- **Styling**: Tailwind CSS utility classes. Use the `cn()` utility from `lib/utils` (wraps `clsx` + `tailwind-merge`) for conditional class merging.
- **Types**: All props and API responses should have TypeScript interfaces (see `types/` directory).
- **State management**: React `useState` / `useEffect`. No external state library.
- **Dark mode**: All components receive a `darkMode` prop and use `cn()` for conditional dark/light classes.

### General

- Line endings: CRLF (Windows development environment).
- No trailing whitespace.
- Use meaningful variable names; avoid single-letter names outside loops.

---

## Testing Instructions

### Backend

There are currently no automated test files. When adding tests:

```bash
cd backend

# Run Django tests
python manage.py test

# Run with verbose output
python manage.py test --verbosity=2

# Run a specific test module
python manage.py test api.tests
```

**Guidelines for writing backend tests:**
- Place test files alongside the app: `backend/api/tests.py` or `backend/api/tests/` directory.
- For AI module tests, create `backend/ai/tests/` — mock OpenAI/Pinecone calls; never make real API calls in tests.
- Test guardrail classes (`InputGuardrail`, `OutputGuardrail`, `FactChecker`) with known-good and adversarial inputs.
- Test management commands: verify `import_phones` correctly loads CSV data.

### Frontend

```bash
cd frontend

# Run React tests (Jest + React Testing Library)
npm test

# Run in CI mode (no watch)
CI=true npm test

# Run with coverage
CI=true npm test -- --coverage
```

**Guidelines for writing frontend tests:**
- Place tests next to components as `ComponentName.test.tsx`.
- Mock API calls — don't hit the real backend.
- Test user interactions (chat input, filter changes, compare selections).

---

## Security Considerations

### API Key Safety

- **Never hardcode** API keys in source files. Always use environment variables.
- The root `.env.local` and `backend/.env` are git-ignored. Verify before committing.
- If rotating keys, update both `backend/.env` and any deployment environment.

### Adversarial Input Protection

The system has **4 layers** of safety checks:

1. **API Entry Point** (`ChatView._check_safety`) — regex-based blocking of 50+ adversarial patterns (API key extraction, prompt reveal, prompt injection, brand attacks, role confusion).
2. **Input Guardrail** (`InputGuardrail.validate`) — validates query relevance to phone/tech topics.
3. **Output Validation** (`OutputGuardrail`) — ensures all phone IDs in responses exist in the database.
4. **Fact Checker** (`FactChecker.verify_claim`) — cross-references LLM claims against actual DB records.

> [!IMPORTANT]
> When modifying prompt templates in `ai/prompts.py`, be careful not to weaken the guardrails. Always test with adversarial prompts (see the Safety table in README.md).

### CORS

CORS is configured in `config/settings.py` to allow `localhost:3000` and `localhost:5173`. Update `CORS_ALLOWED_ORIGINS` when deploying to production.

### Database

- SQLite is used for simplicity. The DB file is at `backend/data/mobiles_india.db`.
- No user authentication is implemented — all endpoints are public.
- The `BuildIndexView` endpoint (`/api/admin/build-index/`) is currently unprotected. Add authentication before deploying.

---