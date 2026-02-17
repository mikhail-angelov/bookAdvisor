# Rutracker Crawler - Application Summary

## 🎯 Core Functionality
- **Web crawler** for rutracker.org torrent forums
- **User authentication** via magic link emails  
- **Torrent annotation system** (ratings, notes, reading status)
- **Real-time monitoring** of crawl progress via Socket.io
- **Search, filter, sort** with pagination
- **Personal library** ("My Books") for annotated torrents

## 🏗️ Architecture Stack
- **Frontend**: Next.js 14 (App Router), React 18, Zustand, Tailwind CSS
- **Backend**: Next.js API routes + custom Node.js server with Socket.io
- **Database**: SQLite with Drizzle ORM, better-sqlite3 driver
- **Auth**: JWT-based magic links, session cookies
- **Email**: Nodemailer SMTP integration

## 📁 Key Directories
```
app/
├── components/          # UI components (TorrentTable, AnnotationDialog, etc.)
├── api/                # Next.js API routes (auth, torrents, crawl, annotations)
├── page.tsx            # Main application page
└── layout.tsx          # Root layout with Toaster
lib/
├── crawler.ts          # Rutracker crawling logic
├── parsers.ts          # HTML parsing for torrent data
├── db/                 # Database schema, migrations, queries
├── auth.ts             # JWT token creation/verification
├── email.ts            # Magic link email sending
└── store.ts            # Zustand client state management
lib/db/migrations/      # SQL migration files (5 tables)
```

## 🔧 Database Schema
- `torrents` - Basic torrent metadata from forum pages
- `torrent_details` - Detailed info from topic pages  
- `crawl` - Raw HTML of crawled pages (for debugging)
- `users` - User accounts
- `user_annotation` - User ratings/notes for torrents
- `magic_link` - Authentication tokens

## 🔄 Crawler Features
- Configurable forum IDs and page limits
- Automatic encoding detection (Windows-1251 support)
- Rate limiting with random delays
- Bulk upsert operations for efficiency
- Error handling with timeout/network recovery
- Real-time status updates via Socket.io

## 🚀 Getting Started
1. Set up environment variables (see `.env.example`)
2. Run database migrations: `npm run db:migrate`
3. Start dev server: `npm run dev`
4. Start backend server: `npm run dev:server`

## ⚠️ Important Notes
- **Legal considerations**: Crawling rutracker.org may violate their terms of service
- **Security**: Default JWT secret should be changed in production
- **Email**: Requires SMTP configuration for magic links to work
- **Scale**: SQLite suitable for personal use; consider PostgreSQL for production

## 📋 API Endpoints
### Authentication
- `POST /api/auth/login` - Request magic link
- `GET /api/auth/verify` - Verify magic link token
- `GET /api/auth/me` - Get current user session

### Torrents
- `GET /api/torrents` - List torrents with search/pagination
- `GET /api/torrents/[id]` - Get single torrent details

### Crawling
- `POST /api/crawl/start` - Start crawler with forumId/maxPages
- `POST /api/crawl/stop` - Stop crawler
- `GET /api/crawl/status` - Get crawler status

### Annotations
- `GET /api/annotations` - Get user's annotations
- `PUT /api/annotations/[torrentId]` - Create/update annotation
- `DELETE /api/annotations/[torrentId]` - Delete annotation

### History
- `GET /api/history` - Get crawl history

## 🔑 Environment Variables
```bash
# SMTP/Email Configuration
POST_SERVICE_URL=smtp.hostingserver.website
POST_USER=no-reply@yourdomain.com
POST_PASS=your-smtp-password
POST_FROM=no-reply@yourdomain.com

# Application URL (used for magic links)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Auth secret for JWT signing
AUTH_SECRET=your-super-secret-jwt-key-change-in-production

# Server Configuration
PORT=3000
NODE_ENV=development
```

## 📊 Key Dependencies
- **next**: 14.2.0
- **react**: 18.2.0
- **zustand**: 5.0.11 - State management
- **drizzle-orm**: 0.45.1 - SQLite ORM
- **better-sqlite3**: 12.6.2 - Database driver
- **axios**: 1.13.5 - HTTP requests
- **cheerio**: 1.0.0-rc.12 - HTML parsing
- **iconv-lite**: 0.7.2 - Encoding conversion
- **socket.io**: 4.8.3 - Real-time updates
- **jsonwebtoken**: 9.0.3 - Authentication
- **nodemailer**: 8.0.1 - Email sending

## 🎨 UI Components
- `Header` - User authentication controls
- `TorrentTable` - Main torrent listing with annotations
- `AnnotationDialog` - Modal for adding/editing annotations
- `CrawlerControls` - Start/stop crawler with settings
- `ProgressBar` - Visual crawler progress indicator
- `StatsCard` - Statistics dashboard
- `SearchBar` - Search and sorting controls
- `Pagination` - Page navigation
- `CrawlHistory` - Previous crawl sessions
- `TabNavigation` - "All" vs "My Books" tabs

## 💾 State Management (Zustand)
The app uses a global store with:
- User authentication state
- Torrent list and selected torrent
- User annotations
- Search/filter/sort parameters
- UI state (active tab, dialog visibility)
- Pagination state

## ⚡ Performance Optimizations
- Bundle splitting with direct component imports
- React transitions for non-urgent updates
- Memoized callbacks and derived state
- Efficient database queries with indexes
- Bulk database operations for crawler

## 🔍 Security Considerations
- JWT tokens for authentication
- HTTP-only cookies for sessions
- Environment-based secrets
- Rate limiting in crawler
- Input validation in API routes

## 🧪 Testing
- Jest configuration present
- Test database with in-memory SQLite
- Separate test environment support

## 📈 Future Considerations
- Migrate to PostgreSQL for production
- Add user roles and permissions
- Implement API rate limiting
- Add export functionality for annotations
- Improve error handling and logging
- Add caching layer for API responses

---

*Summary generated from code investigation on 2025-02-17*