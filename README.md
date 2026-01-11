# Clickpin

An anonymous, hyperlocal message board for Bitcoin merchants. Leave notes, plant seeds, and help grow the Bitcoin economy.

## What is Clickpin?

Clickpin is a location-based social app where users can post anonymous notes that are only visible when physically present at a location. Originally designed as digital corkboards for any place, Clickpin has evolved to focus on **Bitcoin merchant advocacy** - helping users discover, review, and support businesses that accept Bitcoin.

### Core Features

- **Location-locked posts**: Content is only visible when you're physically at a location
- **Anonymous**: No accounts required - uses device-based identity
- **Bitcoin-native**: Lightning Network payments for premium features
- **Merchant claiming**: Business owners can verify and manage their boards
- **Seed planting**: Track and encourage Bitcoin adoption conversations
- **BTCMap integration**: Import Bitcoin-accepting merchants from BTCMap.org

## Key Concepts

### Boards
Each physical location has a "board" - a collection of anonymous posts from people who have visited. Boards can be for Bitcoin merchants, regular businesses, or community spaces.

### Seeds
The "Seed Planted" feature lets users record when they've had a conversation about Bitcoin with a merchant. Track outcomes (positive, neutral, negative) and add optional commentary. This helps the community identify receptive businesses.

### Merchant Claims
Business owners can claim their location by paying a Lightning invoice. Once claimed, they can:
- Customize their board appearance
- Moderate posts
- Add business information
- Display a verified badge

### Ghosts
Top contributors at each location are displayed as "ghosts" - anonymous avatars that represent the most active community members.

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes + Supabase (PostgreSQL + PostGIS)
- **Payments**: Lightning Network (Strike, LNbits, or test mode)
- **Icons**: Phosphor Icons
- **Data**: BTCMap API integration

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

4. **Import BTCMap locations** (optional)
   ```bash
   npx tsx scripts/import-btcmap.ts import --lat=30.2672 --lon=-97.7431 --radius=50
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

## Feature Flags

Clickpin uses feature flags to enable/disable functionality:

| Flag | Description |
|------|-------------|
| `MERCHANTS` | Merchant claiming and management |
| `PAID_PINS` | Lightning payments for posts |
| `BOOSTS` | Pin boosting with Lightning |
| `SPONSORSHIPS` | Location sponsorship |
| `GHOSTS` | Ghost avatars for top contributors |
| `SEED_PLANTED` | Seed planting feature |
| `SHARENOTES` | Shareable pin links |
| `DOODLES` | Drawing on posts |
| `REPLIES` | Reply threads |
| `FLAGS` | Community flagging |
| `PROXIMITY_NEARBY` | Nearby boards view |

## Admin Panel

Access the admin panel at `/admin` to:

- **Stats**: View posts, seeds, sessions, and merchant metrics
- **Locations**: Manage all locations, edit details, view posts
- **Requests**: Approve/reject new location requests
- **Flags**: Toggle feature flags
- **Controls**: Global actions (reset seeds, clear sessions, BTCMap sync)

## API Endpoints

### Core
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session` | POST | Create device session |
| `/api/resolve-location` | POST | Find nearest location |
| `/api/board` | GET | Get board data and pins |
| `/api/pin` | POST/DELETE | Create or delete pins |
| `/api/reply` | POST | Reply to a pin |

### Seeds
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/seed/plant` | POST | Plant a seed at location |
| `/api/seed/count` | GET | Get seed counts |

### Merchants
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/merchant/claim/start` | POST | Start claim process |
| `/api/merchant/claim/lightning` | POST | Generate claim invoice |
| `/api/merchant/settings` | GET/POST | Manage merchant settings |

### Lightning
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/boost/create-invoice` | POST | Boost a pin |
| `/api/sponsor/create-invoice` | POST | Sponsor a location |
| `/api/lightning/webhook` | POST | Payment webhook |

## Configuration

### Payments (satoshis)
- `POST_PRICE_SATS` - Price for paid posts (default: 100)
- `BOOST_PRICE_SATS` - Price to boost a pin (default: 500)
- `CLAIM_PRICE_SATS` - Merchant claim fee (default: 10000)
- `SPONSOR_PRICE_SATS` - Location sponsorship (default: 10000)

### Rate Limiting
- `FREE_POSTS_PER_DAY` - Free posts per location (default: 3)
- `POST_COOLDOWN_MS` - Cooldown between posts (default: 120000)

### Geolocation
- `MAX_ACCURACY_M` - Maximum GPS accuracy (default: 100)
- `MAX_DISTANCE_M` - Maximum distance to board (default: 200)

## Lightning Integration

### Test Mode (Development)
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

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Production Checklist
- Set `DEV_MODE=false`
- Configure real Lightning provider
- Set strong `PRESENCE_TOKEN_SECRET`
- Configure `LIGHTNING_WEBHOOK_SECRET`
- Enable appropriate feature flags

## Database

### Key Tables
- `locations` - Physical locations with PostGIS geography
- `device_sessions` - Anonymous device identities
- `pins` - User posts with optional doodles
- `seed_plantings` - Bitcoin advocacy tracking
- `merchant_claims` - Verified business claims
- `location_requests` - User-submitted location requests

### PostGIS
Uses PostGIS for efficient spatial queries:
- Geographic distance calculations
- Nearest location lookups
- Radius-based filtering

## Contributing

Pull requests welcome. Please ensure:
- TypeScript types are correct
- No security vulnerabilities
- Test on mobile (primary use case)

## License

MIT
