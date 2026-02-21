# Book Advisor

A web application for browsing and managing audio book collections from Rutracker. Built with Next.js, Drizzle ORM, and SQLite.

## Features

- **Browse Books**: Search and filter audio books by title, author, genre
- **Book Details**: View detailed information including author, performer, duration, audio codec
- **Personal Notes**: Save reading status, ratings, and notes for each book (requires authentication)
- **Recommendations**: Get personalized book recommendations based on your ratings (requires authentication)
- **Crawler**: Automatically crawl Rutracker forum for new audio book torrents

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite with Drizzle ORM
- **Authentication**: JWT-based magic link authentication
- **Crawler**: Custom Rutracker parser

## Getting Started

### Prerequisites

- Node.js 18+
- SQLite (built-in)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run database migrations
npm run db:migrate
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
bookAdvisor/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── books/             # Books pages
│   └── recommendations/   # Recommendations page
├── components/            # React components
├── crawler/              # Rutracker crawler
│   ├── parsers.ts        # HTML parsing logic
│   ├── repository.ts     # Database operations
│   └── fetcher.ts       # HTTP fetching
├── db/                   # Database schemas and migrations
├── lib/                 # Utility functions (auth, etc.)
└── public/              # Static assets
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Secret key for JWT tokens |
| `NEXT_PUBLIC_APP_URL` | Application URL |
| `POST_SERVICE_URL` | SMTP server for emails |
| `POST_USER` | SMTP username |
| `POST_PASS` | SMTP password |
| `SMTP_FROM` | From email address |

## Crawler Commands

```bash
# Crawl a forum
npm run crawl -- --forum 2387

# Parse a topic
npm run parse -- --topic 1234567
```

## License

MIT
