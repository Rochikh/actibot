# Actibot

## Overview

Actibot is a multilingual conversational AI assistant that combines document processing with knowledge base retrieval and OpenAI's GPT models. The application provides a chat interface where users can ask questions and receive answers based on uploaded documents, with an admin panel for managing system prompts and documents.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Architecture
- **Frontend**: React with TypeScript, using Vite for development
- **Backend**: Node.js with Express server
- **Database**: PostgreSQL with Drizzle ORM
- **Vector Storage**: pgvector extension for semantic search
- **AI Integration**: OpenAI API for embeddings and chat completions
- **Authentication**: Passport.js with local strategy
- **Styling**: Tailwind CSS with shadcn/ui components

### Project Structure
- `client/` - React frontend application
- `server/` - Express backend server
- `db/` - Database schema and configuration
- `migrations/` - Database migrations

## Key Components

### Database Schema
The application uses PostgreSQL with the following main tables:
- `users` - User accounts with admin privileges
- `documents` - Uploaded documents with metadata
- `document_chunks` - Text chunks with OpenAI embeddings (1536 dimensions)
- `system_prompts` - Configurable AI prompts with model settings
- `chats` - Chat history storage

### Authentication System
- Local username/password authentication
- Session-based authentication with express-session
- Admin role-based access control
- Default admin account (username: admin, password: admin)

### Document Processing Pipeline
1. **Upload**: Files uploaded via multer (10MB limit)
2. **Chunking**: Documents split into 1000-character chunks with overlap
3. **Embedding**: OpenAI text-embedding-3-small generates vector embeddings
4. **Storage**: Chunks stored with pgvector for similarity search

### AI Integration
- **Models**: Supports multiple OpenAI models (GPT-4o, GPT-4o-mini, GPT-3.5-turbo)
- **Embeddings**: Uses text-embedding-3-small for document vectorization
- **RAG Implementation**: Retrieval-Augmented Generation for knowledge-based responses
- **System Prompts**: Configurable prompts stored in database

## Data Flow

### Chat Flow
1. User submits question through React frontend
2. Backend generates embedding for the question
3. pgvector performs similarity search on document chunks
4. Relevant chunks combined with system prompt
5. OpenAI API generates response based on context
6. Response returned to frontend with Markdown formatting

### Document Management Flow
1. Admin uploads document via admin panel
2. Server processes document into chunks
3. Each chunk gets OpenAI embedding
4. Chunks stored in database with vector index
5. Document available for semantic search

### Admin Operations
- Document upload and management
- System prompt configuration
- Model selection and parameters
- User management and password changes

## External Dependencies

### Core Dependencies
- **OpenAI API**: Chat completions and embeddings
- **PostgreSQL**: Primary database with pgvector extension
- **SendGrid**: Email notifications (configured but optional)

### Frontend Libraries
- React Query for state management
- React Hook Form with Zod validation
- Wouter for routing
- Radix UI components via shadcn/ui
- React Markdown for message formatting

### Backend Libraries
- Express.js web framework
- Passport.js for authentication
- Multer for file uploads
- Drizzle ORM for database operations
- CORS enabled for cross-origin requests

## Deployment Strategy

### Development
- Vite dev server for frontend hot reloading
- tsx for TypeScript execution in development
- Concurrent frontend and backend development

### Production Build
- Vite builds optimized frontend bundle
- esbuild bundles backend for Node.js
- Static assets served from Express
- Database migrations via Drizzle Kit

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API authentication
- `SENDGRID_API_KEY`: Email service (optional)
- `SENDGRID_FROM_EMAIL`: Email sender address

### Key Features
- Real-time chat interface with typing indicators
- Document upload with automatic processing
- Semantic search using vector embeddings
- Admin panel for system configuration
- Responsive design with mobile support
- Session-based authentication
- Markdown rendering for rich text responses

The application follows a typical RAG (Retrieval-Augmented Generation) pattern where user questions are matched against a knowledge base of processed documents, and the most relevant information is provided to the AI model for generating contextual responses.

## Recent Updates (August 5, 2025)

### Chunking Temporel Claude 4.0 Implémenté (Août 5, 2025) - ✅
- **PROBLÈME RÉSOLU** : Chunking thématique cassait la continuité temporelle des conversations WhatsApp
- **SOLUTION CLAUDE 4.0** : Chunking temporel avec métadonnées conversationnelles
- **ARCHITECTURE** : 
  - Chunks de 400-600 tokens maintenant le contexte conversationnel
  - Overlap de 5 messages entre chunks pour continuité
  - Métadonnées par chunk : date_start, date_end, participants, topics
  - 2320 chunks temporels générés vs 45 chunks thématiques précédents
- **MISE À JOUR HEBDOMADAIRE** : Système automatique pour nouveaux exports WhatsApp
- **RÉSULTAT** : Continuité temporelle préservée, recherche sémantique optimisée sur période complète (oct 2023 → jul 2025)

### Vector Store Optimization (July 30, 2025) - DÉPASSÉ
- Remplacé par le système de chunking temporel plus efficace

## Recent Updates (July 30, 2025)

### Document Processing Fixed (July 30, 2025)
- Resolved issue with WhatsApp file update not being processed properly
- New discussions from July 16-30, 2025 now integrated into knowledge base
- Auto-division system successfully processed 22 chunks from complete WhatsApp history
- Manual processing backup system implemented for failed incremental updates

### Link Extraction System Implemented (July 16, 2025)
- Resolved issue where responses displayed cryptic references like `[4:1 source]` instead of actual shared links
- System now extracts real HTTP/HTTPS links from WhatsApp discussions and makes them clickable
- Links display with descriptive icons (🔗 Aide Google Gemini, 🎥 Vidéo YouTube, etc.)
- Assistant updated to automatically include contributor links in responses
- Improved user experience with clean, clickable links from community discussions

### Assistant Configuration Fixed
- Corrected assistant ID from "AI-Dialogue actif" (gpt-4.1-mini - non-existent) to "ActiBot" (asst_JerNOWvyU63gex8p0z3gSv8r)
- Now uses gpt-4o-mini model with File Search enabled
- Vector Store contains WhatsApp discussion file (3MB, 27069 lines)

### Auto-Division System Implemented
- Created automatic file splitting system for documents exceeding 5000 lines or 1MB
- WhatsApp files divided by time periods (monthly chunks)
- Generic files divided into fixed-size blocks (5000 lines each)
- Automatic integration into document upload process
- Admin interface for manual splitting and monitoring
- Chunks automatically uploaded to OpenAI Vector Store for improved search performance

### Performance Improvements
- Large files now automatically split into manageable chunks
- Better indexing in OpenAI Vector Store for more accurate search
- Reduced response time for queries on large datasets
- Improved File Search performance with targeted chunk retrieval

### Architecture Status
- Direct OpenAI Assistant API integration working effectively
- Auto-division system integrated into upload pipeline
- Admin interface enhanced with split monitoring capabilities
- Embedded chatbot successfully deployed on external sites
- Link extraction system processes contributor-shared URLs for better user experience