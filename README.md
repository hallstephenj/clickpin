# Clickpin

**Location-anchored bulletin boards for the physical world.**

## The Concept

Clickpin explores what happens when digital message boards are anchored to physical locations. You can only post to a board when you're actually there. No remote participation—just people who showed up.

This creates an interesting design space: anonymous coordination tied to physical presence. The constraint of "you must be here" changes everything about how people interact.

## How It Works

Every physical location can have a board—a collection of anonymous posts from people who have visited. Boards are unlocked by GPS proximity. Post something, and it stays pinned to that spot for others who visit later.

**Core mechanics:**
- **Proximity-gated posting**: GPS verification required to contribute
- **Device-based identity**: No accounts, no email, no phone numbers
- **Ephemeral presence**: Your session exists only while you're there
- **Persistent content**: Posts remain for future visitors

## Core Features

### Boards & Pins
Location-locked message boards where users can post text, drawings, and media. Pins can receive replies, creating threaded conversations anchored to physical places.

### Seed Planting
Track conversations and outcomes at locations over time. Record whether an interaction was positive, neutral, or negative. Build a history that helps others who visit later.

### Doodles
Freehand drawing tool for visual posts. Sketch maps, diagrams, or just leave your mark.

### Boosts & Sponsorships
Lightning-powered promotion. Boost individual pins to increase visibility, or sponsor entire locations to support the network.

### Merchant Claims
Business owners can claim their location by paying a Lightning invoice. Claimed locations get verified badges, moderation controls, and customization options.

### BTCMap Integration
Import bitcoin-accepting merchants from BTCMap. Export new merchants back to the ecosystem when they start accepting bitcoin.

### Nearby Discovery
Browse boards in your vicinity. See what's happening at locations around you without walking to each one.

### Shareable Links
Generate links to specific pins that can be shared outside the app. Recipients still need proximity to interact, but can preview content.

## Use Cases

The location-locked bulletin board pattern enables several applications:

### Grassroots Coordination
Track conversations and outcomes at specific locations over time. Multiple people visiting the same place can coordinate asynchronously without ever meeting.

### Bitcoin Merchant Adoption
One application: coordinating grassroots bitcoin adoption. Visit a business, have a conversation about accepting bitcoin, log the outcome. Others who visit later can see the history and continue the conversation. Integrates with BTCMap for tracking merchants who accept bitcoin.

### Local Discovery
Anonymous tips and notes about places—what's good, what to avoid, insider knowledge that only locals would know.

### Community Spaces
Boards for parks, venues, and gathering places. Temporary coordination for events, or persistent community knowledge.

## Architecture

### Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes + Supabase (PostgreSQL + PostGIS)
- **Payments**: Lightning Network (Strike, LNbits, or test mode)
- **Icons**: Phosphor Icons
- **Data**: BTCMap API integration

### Key Design Decisions

**PostGIS for spatial queries**: Efficient geographic distance calculations, nearest-location lookups, and radius-based filtering.

**Device sessions over accounts**: Privacy-preserving identity using device fingerprinting. No PII collected.

**Lightning-native monetization**: Boosts, sponsorships, and paid pins keep infrastructure running without ads or data harvesting.

**Feature flags**: Modular functionality that can be enabled/disabled per deployment.

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Supabase account (free tier works)

### Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/hallstephenj/clickpin.git
   cd clickpin
   npm install
   ```

2. **Configure Supabase**
   - Create a project at [supabase.com](https://supabase.com)
   - Run migrations from `supabase/migrations/` in the SQL Editor
   - Copy your API credentials

3. **Environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

   Required:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PRESENCE_TOKEN_SECRET` (generate with `openssl rand -hex 32`)

4. **Import seed locations** (optional)
   ```bash
   npx tsx scripts/import-btcmap.ts import --lat=30.2672 --lon=-97.7431 --radius=50
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

## Feature Flags

| Flag | Description |
|------|-------------|
| `MERCHANTS` | Merchant claiming and management |
| `PAID_PINS` | Lightning payments for posts |
| `BOOSTS` | Pin boosting with Lightning |
| `SPONSORSHIPS` | Location sponsorship |
| `SEED_PLANTED` | Conversation tracking feature |
| `SHARENOTES` | Shareable pin links |
| `DOODLES` | Drawing on posts |
| `REPLIES` | Reply threads |
| `FLAGS` | Community flagging |
| `PROXIMITY_NEARBY` | Nearby boards view |

## Admin Panel

Access `/admin` to manage:

- **Stats**: Posts, sessions, locations, activity metrics
- **Locations**: Create, edit, and manage all locations
- **Requests**: Approve/reject user-submitted location requests
- **Flags**: Toggle feature flags
- **Controls**: Global actions and data management

## API Overview

### Core Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session` | POST | Create device session |
| `/api/resolve-location` | POST | Find nearest location |
| `/api/board` | GET | Get board data and pins |
| `/api/pin` | POST/DELETE | Create or delete pins |
| `/api/reply` | POST | Reply to a pin |

### Lightning Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/boost/create-invoice` | POST | Boost a pin |
| `/api/sponsor/create-invoice` | POST | Sponsor a location |
| `/api/lightning/webhook` | POST | Payment webhook |

## Configuration

### Payments (satoshis)
- `POST_PRICE_SATS` - Price for paid posts (default: 100)
- `BOOST_PRICE_SATS` - Price to boost a pin (default: 500)
- `CLAIM_PRICE_SATS` - Location claim fee (default: 10000)
- `SPONSOR_PRICE_SATS` - Location sponsorship (default: 10000)

### Geolocation
- `MAX_ACCURACY_M` - Maximum GPS accuracy required (default: 100)
- `MAX_DISTANCE_M` - Maximum distance to board for posting (default: 200)

### Rate Limiting
- `FREE_POSTS_PER_DAY` - Free posts per location (default: 3)
- `POST_COOLDOWN_MS` - Cooldown between posts (default: 120000)

## Lightning Integration

### Test Mode
```bash
DEV_MODE=true
LIGHTNING_TEST_MODE=true
```
Use "Simulate Payment" in modals or the test wallet at `/test-wallet`.

### Production
```bash
# Strike
LIGHTNING_PROVIDER=strike
STRIKE_API_KEY=your-api-key

# LNbits
LIGHTNING_PROVIDER=lnbits
LNBITS_URL=https://your-instance
LNBITS_API_KEY=your-api-key
```

## Database Schema

### Key Tables
- `locations` - Physical locations with PostGIS geography
- `device_sessions` - Anonymous device identities
- `pins` - User posts with optional attachments
- `seed_plantings` - Conversation outcome tracking
- `merchant_claims` - Verified business claims
- `location_requests` - User-submitted location requests

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Production Checklist
- Set `DEV_MODE=false`
- Configure Lightning provider
- Set strong `PRESENCE_TOKEN_SECRET`
- Configure `LIGHTNING_WEBHOOK_SECRET`
- Enable appropriate feature flags

## Contributing

Pull requests welcome. Please ensure:
- TypeScript types are correct
- No security vulnerabilities
- Test on mobile (primary use case)

## License

MIT
