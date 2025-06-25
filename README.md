# BoSar API

A NestJS-based API for managing customer chat conversations with AI bot integration and human takeover capabilities.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control (Admin/Agent)
- **User Management**: Create and manage admin and agent users
- **Bot Settings**: Configure AI bot parameters (model, temperature, system instructions, tools)
- **Knowledge Base**: FAQ management and vector embeddings for RAG functionality
- **PDF Document Management**: Upload, process, and search PDF documents with text extraction
- **Conversations**: Manage customer conversations with chat history and message threading
- **Chat Messages**: HTTP-based messaging system with pagination and role-based access
- **Human Takeover**: Manual and automatic agent takeover with audit trails
- **Vector Search**: Semantic search across knowledge base and documents
- **Email Integration**: Password reset functionality with Postmark
- **File Upload**: PDF file upload with validation and processing
- **Global Error Handling**: Comprehensive exception filtering and logging
- **API Documentation**: Complete Swagger/OpenAPI documentation

## Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Passport
- **File Upload**: Multer for multipart/form-data handling
- **Documentation**: Swagger
- **Email**: Postmark
- **Validation**: class-validator and class-transformer
- **Error Handling**: Global exception filters and logging interceptors

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Postmark account for email functionality

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd BosarChatAPI
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Update the `.env` file with your configuration:

```env
NODE_ENV=development
DATABASE_URL="postgresql://username:password@localhost:5432/bosar?schema=public"

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# Postmark Email Service
POSTMARK_API_KEY=your-postmark-api-key
FROM_EMAIL=your-from-email@domain.com

# Frontend URL for password reset links
FRONTEND_URL=http://localhost:3000
```

4. Set up the database:

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database with initial data
npm run db:seed
```

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod
```

The API will be available at `http://localhost:3001` (or the port specified in your environment).

## API Documentation

Swagger documentation is available only in development mode. When running the application with `NODE_ENV=development`, you can access the Swagger documentation at:

```
http://localhost:3001/api
```

**Note**: Swagger documentation is disabled in production mode for security reasons.

## Default Users

After running the seed script, you'll have these default users:

- **Admin**: `admin@bosar.com` / `admin123`
- **Agent**: `agent@bosar.com` / `agent123`

## API Endpoints

### Authentication

- `POST /auth/login` - User login
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token

### Users

- `GET /users` - Get all users
- `POST /users` - Create user (Admin only)
- `GET /users/profile` - Get current user profile
- `PATCH /users/profile` - Update current user profile
- `GET /users/:id` - Get user by ID
- `PATCH /users/:id` - Update user (Admin only)
- `DELETE /users/:id` - Delete user (Admin only)

### Bot Settings

- `GET /bot-settings` - Get all bot settings
- `POST /bot-settings` - Create bot settings (Admin only)
- `GET /bot-settings/latest` - Get latest bot settings
- `GET /bot-settings/:id` - Get bot settings by ID
- `PATCH /bot-settings/:id` - Update bot settings (Admin only)
- `DELETE /bot-settings/:id` - Delete bot settings (Admin only)

### FAQ

- `GET /faq` - Get all FAQ entries
- `POST /faq` - Create FAQ entry (Admin only)
- `GET /faq/:id` - Get FAQ by ID
- `PATCH /faq/:id` - Update FAQ (Admin only)
- `DELETE /faq/:id` - Delete FAQ (Admin only)

### Conversations

- `GET /conversations` - Get all conversations (filtered by role)
- `POST /conversations` - Create conversation
- `GET /conversations/:id` - Get conversation by ID
- `PATCH /conversations/:id` - Update conversation
- `POST /conversations/:id/human-takeover` - Trigger human takeover
- `DELETE /conversations/:id` - Delete conversation

### Chat Messages

- `POST /chat-messages` - Send a chat message
- `GET /chat-messages/conversation/:conversationId` - Get messages for a conversation (with pagination)
- `GET /chat-messages/:id` - Get a specific message by ID
- `DELETE /chat-messages/:id` - Delete a message

### PDF Documents

- `GET /pdf-documents` - Get all PDF documents
- `POST /pdf-documents` - Create PDF document entry (Admin only)
- `POST /pdf-documents/upload` - Upload PDF file (Admin only)
- `GET /pdf-documents/search` - Search PDF documents
- `GET /pdf-documents/:id` - Get PDF document by ID
- `PATCH /pdf-documents/:id` - Update PDF document (Admin only)
- `DELETE /pdf-documents/:id` - Delete PDF document (Admin only)

### Knowledge Base

- `GET /knowledge-base` - Get all knowledge bases
- `POST /knowledge-base` - Create knowledge base (Admin only)
- `POST /knowledge-base/search` - Search knowledge base with vector similarity
- `POST /knowledge-base/rebuild/:botSettingsId` - Rebuild knowledge base from sources (Admin only)
- `GET /knowledge-base/:id` - Get knowledge base by ID
- `PATCH /knowledge-base/:id` - Update knowledge base (Admin only)
- `DELETE /knowledge-base/:id` - Delete knowledge base (Admin only)

## Swagger Documentation

The complete API documentation is available in two formats:

1. **Interactive Swagger UI**: `http://localhost:3001/api` (development mode only)
2. **Swagger JSON**: Available in the `swagger.json` file in the project root

**Important**: Swagger documentation is only accessible when `NODE_ENV=development`. In production mode, the Swagger endpoints are disabled for security reasons.

To regenerate the Swagger JSON file:

```bash
npm run swagger:generate
```

## Database Schema

The application uses the following main entities:

- **User**: Admin and agent users with authentication
- **BotSettings**: AI bot configuration
- **FAQ**: Knowledge base entries
- **Conversation**: Customer chat sessions
- **ChatMessage**: Individual messages in conversations
- **HumanTakeover**: Audit trail for human interventions
- **PasswordResetRequest**: Password reset tokens
- **PDFDocument**: Uploaded PDF files with extracted content chunks
- **KnowledgeBase**: Vector embeddings for semantic search

## Testing

### API Testing

You can test the API using the Swagger interface at `http://localhost:3001/api` (in development mode) or use curl commands:

```bash
# Login to get JWT token
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bosar.com","password":"admin123"}'

# Test knowledge base search
curl -X POST http://localhost:3001/knowledge-base/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"query":"business hours","limit":3}'

# Create a test conversation
curl -X POST http://localhost:3001/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"customerId":"test-customer-123"}'
```

### Chat Messages Testing

Test the HTTP-based chat messaging system:

```bash
# Create a conversation
curl -X POST http://localhost:3001/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"customerId":"test-customer-123"}'

# Send a user message
curl -X POST http://localhost:3001/chat-messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"conversationId":"CONVERSATION_ID","message":"Hello, I need help","role":"user"}'

# Send a bot response
curl -X POST http://localhost:3001/chat-messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"conversationId":"CONVERSATION_ID","message":"How can I help you?","role":"bot"}'

# Get conversation messages
curl -X GET "http://localhost:3001/chat-messages/conversation/CONVERSATION_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test automatic human takeover
curl -X POST http://localhost:3001/chat-messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"conversationId":"CONVERSATION_ID","message":"I want to speak to a human agent","role":"user"}'
```

### File Upload Testing

Test PDF upload functionality:

```bash
# Upload a PDF file (Admin only)
curl -X POST http://localhost:3001/pdf-documents/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/your/document.pdf"
```

## Development

```bash
# Run in development mode with hot reload
npm run start:dev

# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## Database Operations

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create and apply new migration
npx prisma migrate dev --name migration-name

# Reset database (development only)
npx prisma migrate reset

# Seed database
npm run db:seed

# View database in Prisma Studio
npx prisma studio
```

## Deployment

For production deployment, consider:

- Setting up proper environment variables
- Configuring database connection pooling
- Setting up monitoring and logging
- Using a process manager like PM2
- Setting up SSL/TLS certificates
- Configuring CORS for your frontend domain

## License

This project is licensed under the MIT License.
