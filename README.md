# Clickpin

Anonymous, location-locked pinboards for real physical places.

## Overview

Clickpin is a hyperlocal social app where users can post anonymous text notes (pins) that are only visible when you're physically at a specific location. Think of it as a digital corkboard for stadiums, parks, restaurants, and other public places.

### Key Features

- **Location-locked**: Posts are only visible when you're physically near a location
- **Anonymous**: No accounts required - uses device-based soft identity
- **Community moderated**: Flag inappropriate content
- **Lightning payments**: Pay with Bitcoin Lightning for premium features
- **Real-time updates**: See new pins appear instantly

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes + Supabase (PostgreSQL + PostGIS + Realtime)
- **Payments**: Lightning Network (DEV mode included for testing)

## Quick Start

### 1. Prerequisites

- Node.js 18+
- npm
- A Supabase account (free tier works)

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned
3. Go to Project Settings > API and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Run Migrations

1. Go to the Supabase Dashboard > SQL Editor
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run the SQL to create all tables, indexes, and functions

### 4. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PRESENCE_TOKEN_SECRET` (generate with `openssl rand -hex 32`)

### 5. Install Dependencies

```bash
npm install
```

### 6. Seed Locations

```bash
npx tsx scripts/seed.ts
```

This will add ~30 Austin, TX locations to your database.

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Allow location access** when prompted
2. **Find a board** - If you're near a seeded location, you'll see its pinboard
3. **Create a pin** - Click "+ Pin" to compose a new post
4. **Add a doodle** - Optionally draw something with the pen tool
5. **Reply to pins** - Click "Reply" on any pin
6. **Flag inappropriate content** - Click "Flag" to report
7. **Boost pins** - Pay Lightning to boost a pin to the top
8. **Delete your pins** - Free within 10 minutes, paid after

## Testing Without Being at a Location

For development/testing, you can:

1. **Modify your browser's geolocation** using DevTools:
   - Chrome: DevTools > Sensors > Geolocation > Override
   - Use coordinates from `scripts/austin-locations.json`

2. **Add a test location near you**:
   ```sql
   INSERT INTO locations (name, slug, category, lat, lng, radius_m, is_active)
   VALUES ('Test Location', 'test-location', 'test', YOUR_LAT, YOUR_LNG, 500, true);
   ```

## Payment Testing (DEV Mode)

With `DEV_MODE=true`, you can simulate Lightning payments:

1. Create an invoice (boost, delete, etc.)
2. Copy the `invoice_id` from the modal
3. Call the DEV endpoint to mark it paid:

```bash
curl -X POST http://localhost:3000/api/dev/mark-paid \
  -H "Content-Type: application/json" \
  -d '{"invoice_id": "dev_xxx..."}'
```

Or click "Simulate Payment" in the payment modal.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session` | POST | Create/refresh device session |
| `/api/resolve-location` | POST | Find nearest location |
| `/api/board` | GET | Get pins for a location |
| `/api/pin` | POST | Create a new pin |
| `/api/pin` | DELETE | Delete a pin |
| `/api/reply` | POST | Reply to a pin |
| `/api/flag` | POST | Flag a pin |
| `/api/boost/create-invoice` | POST | Create boost invoice |
| `/api/delete/create-invoice` | POST | Create deletion invoice |
| `/api/post/create-invoice` | POST | Create paid post invoice |
| `/api/sponsor/create-invoice` | POST | Create sponsorship invoice |
| `/api/lightning/webhook` | POST | Payment webhook |
| `/api/dev/mark-paid` | POST | DEV: Simulate payment |

## Configuration

All settings can be customized via environment variables:

### Geolocation
- `MAX_ACCURACY_M` (default: 100) - Maximum GPS accuracy allowed
- `MAX_DISTANCE_M` (default: 200) - Maximum distance to a board

### Rate Limiting
- `FREE_POSTS_PER_DAY` (default: 3) - Free posts per location per day
- `POST_COOLDOWN_MS` (default: 120000) - Cooldown between posts (2 min)

### Moderation
- `FLAG_THRESHOLD` (default: 5) - Flags needed to hide a pin

### Payments (in satoshis)
- `POST_PRICE_SATS` (default: 100) - Price for paid posts
- `BOOST_PRICE_SATS` (default: 500) - Price to boost a pin
- `DELETE_PRICE_SATS` (default: 200) - Price for late deletion
- `SPONSOR_PRICE_SATS` (default: 10000) - Price to sponsor a location

### Timing
- `FREE_DELETE_WINDOW_MS` (default: 600000) - Free delete window (10 min)
- `BOOST_DURATION_HOURS` (default: 24) - How long boosts last
- `SPONSOR_DURATION_DAYS` (default: 30) - How long sponsorships last

## Anti-Spam Knobs

To combat abuse, adjust these settings:

1. **Increase cooldown**: Set `POST_COOLDOWN_MS=300000` (5 minutes)
2. **Reduce free posts**: Set `FREE_POSTS_PER_DAY=1`
3. **Require payment for all posts**: Set `FREE_POSTS_PER_DAY=0`
4. **Lower flag threshold**: Set `FLAG_THRESHOLD=3`
5. **Tighten location accuracy**: Set `MAX_ACCURACY_M=50`

## Deploying to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables from `.env.local`
4. Deploy!

For production:
- Set `DEV_MODE=false`
- Configure a real Lightning provider (Strike or LNbits)
- Set a strong `PRESENCE_TOKEN_SECRET`
- Configure `LIGHTNING_WEBHOOK_SECRET`

## Database Schema

### Tables
- `locations` - Physical locations with PostGIS geography
- `device_sessions` - Anonymous device identities
- `pins` - User posts (text + optional doodle)
- `pin_flags` - Community flags for moderation
- `pin_boosts` - Lightning payments for boosting
- `location_sponsorships` - Location sponsorship payments
- `pin_deletion_payments` - Paid deletion payments
- `post_quota_ledger` - Daily post tracking
- `post_payments` - Paid post invoices

### PostGIS Features
- Spatial index on location geography
- `find_nearest_location()` function for efficient proximity queries
- Automatic geography column generation from lat/lng

## Production Lightning Integration

To use real Lightning payments, set up:

### Strike (Recommended)
```bash
LIGHTNING_PROVIDER=strike
STRIKE_API_KEY=your-api-key
```

### LNbits
```bash
LIGHTNING_PROVIDER=lnbits
LNBITS_URL=https://your-lnbits-instance
LNBITS_API_KEY=your-api-key
```

Then implement the provider methods in `lib/lightning.ts`.

## Contributing

Pull requests welcome! Please ensure:
- TypeScript types are correct
- Code is formatted with Prettier
- No security vulnerabilities introduced

## License

MIT
