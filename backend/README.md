# MobiAdvisor Backend

Django REST API for the MobiAdvisor AI Phone Shopping Assistant.

## Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python manage.py migrate
python manage.py import_phones
python manage.py runserver
```

## Environment Variables

Create `.env` file:
```
OPENAI_API_KEY=your_key_here
PINECONE_API_KEY=your_key_here
DEBUG=True
```

## API Endpoints

- `POST /api/chat/` - Chat with AI assistant
- `POST /api/compare/` - Compare phones with AI analysis
- `GET /api/phones/` - List phones with filters
- `GET /api/filters/` - Get filter metadata
