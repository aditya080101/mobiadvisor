# MobiAdvisor Frontend

React + TypeScript frontend for the MobiAdvisor AI Phone Shopping Assistant.

## Setup

```bash
cd frontend
npm install
```

## Development

```bash
# Start development server (proxies API to Django at localhost:8000)
npm start
```

Frontend runs at `http://localhost:3000`

## Build

```bash
npm run build
```

## Environment Variables

Create `.env`:
```
REACT_APP_API_URL=http://localhost:8000/api
```

## Tech Stack

- **React 18** with TypeScript
- **Create React App** for bundling
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **DOMPurify** for XSS protection

## Project Structure

```
src/
├── api/
│   └── client.ts       # API client for Django backend
├── components/
│   ├── chat/           # Chat tab components
│   ├── browse/         # Browse tab components
│   ├── compare/        # Compare tab components
│   ├── phone/          # Phone card component
│   └── ui/             # Reusable UI components
├── lib/
│   └── utils.ts        # Utility functions
├── types/
│   └── index.ts        # TypeScript interfaces
├── App.tsx             # Main application
├── index.tsx           # Entry point
└── index.css           # Global styles
```
