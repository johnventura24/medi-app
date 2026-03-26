# Medicare Advantage Analytics Dashboard

## Overview

A comprehensive Medicare Advantage benefits analytics platform designed for lead generation and market analysis. The dashboard provides geographic heatmaps, benefit mapping, carrier comparisons, and AI-driven targeting recommendations to help identify high-opportunity markets for Medicare Advantage products.

The platform enables users to analyze Medicare plans across states, cities, and ZIP codes, comparing benefits like dental allowances, OTC coverage, flex cards, grocery allowances, and transportation benefits.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints prefixed with `/api`
- **Build**: esbuild for production bundling with selective dependency bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` for shared types between frontend and backend
- **Validation**: Zod schemas with drizzle-zod integration
- **Storage Interface**: Abstracted storage interface (`IStorage`) supporting multiple backends (currently in-memory)

### Project Structure
```
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route page components
│   │   ├── data/         # Example data files (deprecated - API used)
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities and providers
├── server/           # Express backend
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data storage abstraction
│   └── static.ts     # Static file serving
├── shared/           # Shared code between client/server
│   └── schema.ts     # Database schema and types
└── migrations/       # Drizzle database migrations
```

### Design System
- Carbon Design + Linear-inspired approach for data-focused dashboards
- Typography: Inter (primary), JetBrains Mono (numerical data)
- Light/dark theme support with CSS custom properties
- Consistent spacing using Tailwind units (3, 4, 6, 8, 12, 16)

### Key Pages
1. **State Heatmap** - Geographic benefit visualization by state
2. **City Reports** - City-level plan and benefit analysis
3. **ZIP Rankings** - ZIP code opportunity scoring
4. **Benefit Views** - Detailed benefit category analysis
5. **Carrier Comparison** - Insurance carrier metrics comparison
6. **Plan Comparison** - Side-by-side plan details
7. **Recommendations** - AI-driven targeting suggestions

## External Dependencies

### Database
- **PostgreSQL** - Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit** - Database migrations and schema management

### UI Libraries
- **Radix UI** - Accessible component primitives (dialog, dropdown, tabs, etc.)
- **Recharts** - Chart library for data visualization
- **react-simple-maps** - US map visualization for geographic heatmaps
- **embla-carousel-react** - Carousel component
- **react-day-picker** - Date picker component
- **cmdk** - Command palette component

### Backend Services
- **express-session** with connect-pg-simple - Session management
- **passport** with passport-local - Authentication framework

### Development Tools
- **Vite** - Frontend build and dev server
- **esbuild** - Production server bundling
- **TypeScript** - Type checking across the codebase

### Third-Party APIs (configured but not yet integrated)
- **OpenAI** - AI capabilities (package installed)
- **Google Generative AI** - AI capabilities (package installed)
- **Stripe** - Payment processing (package installed)

### API Integration Status
All dashboard pages are connected to the backend API via TanStack Query:
- **GET /api/states** - State-level benefit data for heatmap
- **GET /api/cities** - City-level reports data (county-based)
- **GET /api/zips** - ZIP code rankings with desirability scores
- **GET /api/carriers** - Insurance carrier comparison data
- **GET /api/plans** - Individual plan details for comparison
- **GET /api/recommendations** - AI-driven targeting recommendations
- **GET /api/averages** - National average statistics

### Data Source
Data is imported from the CMS Medicare Advantage Benefits Report (XLSB format).
- **Source file**: `attached_assets/MA_BENEFITS_REPORT_20250516_1765500234874.xlsb`
- **Import script**: `scripts/importBenefitsData.ts`
- **Output**: `server/data/benefitsData.ts`

Current data includes:
- ~142,000 plan records across all 51 states/territories
- 200 counties/cities with carrier and plan count data
- 30 insurance carriers with market share analysis
- 30 individual plans with detailed benefit information

**Data Import Options:**
1. **UI Upload**: Go to Settings page and use the file upload to import new XLSB files
2. **Command line**: `NODE_OPTIONS="--max-old-space-size=8192" npx tsx scripts/importBenefitsData.ts [optional-file-path]`

### Benefit Detail Views
Each benefit type has a dedicated detail page accessible at `/benefits/:type`:
- `/benefits/dental` - Dental coverage details
- `/benefits/otc` - OTC allowance details
- `/benefits/flex-card` - Flex card details
- `/benefits/groceries` - Grocery allowance details
- `/benefits/transportation` - Transportation benefit details

Each benefit detail view shows:
- Average benefit amount across all states
- Average coverage percentage
- Top 15 states ranked by benefit amount
- ZIP codes offering the benefit with max amounts