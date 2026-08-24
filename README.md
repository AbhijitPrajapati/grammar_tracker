# Grammar Tracker

English learners often face no shortage of substantial grammatical feedback. Nonetheless, identifying and prioritizing recurring mistakes across many speaking attempts remains inconvenient. This full-stack language-learning application targets this issue by seamlessly maintaining a persistent record of grammatical errors in order to characterize a learner's progress over time.

Users submit short speech samples, which are transcribed and analyzed for grammatical inaccuracies. Detected errors are categorized, explained, and stored, allowing the system to identify long-term trends across grammatical categories and multiple timeframes. 

## Processing Pipeline

1. User submits a speech sample.
2. Audio is transcribed.
3. Transcript is analyzed for grammatical innaccuracies.
4. Detected errors are categorized, explained, and persisted.
5. Historical error data is aggregated into progress analytics.

## Features

### Speech Processing

- Audio transcription
- AI-driven grammatical analysis
- Persistent speech history
- Clear, concise corrections
- Error categorization
- Details explanations for each individual error

### Analytics

- Persistent error history
- Error distribution by category
- Error frequency trends over time
- Weekly, monthly, yearly, and all-time statistics

### Authentication

- Complete User registration and authentication flow
- Personally-contained speech history and analytics

## Architecture

```text
Next.js
   |
   v
FastAPI
   |
   +----> OpenAI Transcription
   |
   +----> OpenAI Text Analysis
   |
   v
PostgreSQL
```

The frontend, backend, and database are deployed independently. The FastAPI service manages authentication, speech processing, grammatical analysis, persistence, and analytics, while Next.js presents an elegant user experience.

## Technologies

**Frontend**
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

**Backend**
- Python
- FastAPI
- SQLAlchemy
- PostgreSQL

**Machine Learning Services**
- OpenAI API for speech transcription and text analysis

## Project Scope

Grammar Tracker is a comprehensive end-to-end machine learning application rather than an isolated model demonstration. Integrating ML services with surrounding infrastructure, it includes user data persistence, a tested backend API, a complete web interface, and a stable production environment.

This application is currently feature-complete and deployed.
