# SEED_PLANTED Feature Specification

## Overview

Add a new feature flag `SEED_PLANTED` that enables coordinated Bitcoin advocacy at non-Bitcoin-accepting merchant locations. This includes a new location categorization system, visual board theming, and a tracking system for user-merchant Bitcoin conversations.

---

## 1. Location Categories (Database Schema Update)

### Current Schema
```sql
-- locations table has:
is_bitcoin_merchant BOOLEAN  -- from BTCMap integration
is_claimed BOOLEAN           -- merchant claim status
```

### New Schema
Add to `locations` table:
```sql
ALTER TABLE locations ADD COLUMN location_type TEXT DEFAULT 'merchant';
-- Valid values: 'bitcoin_merchant', 'merchant', 'community_space'

-- Migration logic:
-- If is_bitcoin_merchant = true → location_type = 'bitcoin_merchant'
-- If is_bitcoin_merchant = false AND is_claimed = true → location_type = 'merchant'
-- Otherwise → keep existing or allow manual setting
```

### Location Type Definitions

| Type | Color | Description |
|------|-------|-------------|
| `bitcoin_merchant` | Orange (#F7931A) | Accepts Bitcoin (BTCMap verified or manually set) |
| `merchant` | Gray (#6B7280) | Business that doesn't accept Bitcoin yet |
| `community_space` | Blue (#3B82F6) | Non-commercial community gathering spot |
| User's location | Red (#EF4444) | Current user's position on map |

---

## 2. Update Location Request Form

**File:** `components/RequestLocationModal.tsx` or equivalent

Add a dropdown/radio selection for location type when requesting a new board:

```tsx
<select name="location_type">
  <option value="merchant">Business (doesn't accept Bitcoin)</option>
  <option value="bitcoin_merchant">Business (accepts Bitcoin)</option>
  <option value="community_space">Community Space</option>
</select>
```

Update the API route `api/location-request` to accept and store `location_type`.

---

## 3. Board Visual Theming

### 3.1 Dismissible Banners

**File:** Create `components/BoardBanner.tsx`

```tsx
interface BoardBannerProps {
  locationType: 'bitcoin_merchant' | 'merchant' | 'community_space';
  onDismiss: () => void;
}
```

| Location Type | Banner Color | Text |
|---------------|--------------|------|
| `merchant` | Gray bg (#6B7280) | "This merchant doesn't yet accept bitcoin." |
| `community_space` | Blue bg (#3B82F6) | "You're visiting a bitcoin community space." |
| `bitcoin_merchant` | No banner | (use glow effect instead) |

Banner should:
- Appear at very top of board page
- Have small "×" dismiss button on right
- Store dismissal in localStorage per location: `banner_dismissed_{location_id}`
- Be a thin ribbon style (~40px height)

### 3.2 Bitcoin Merchant Glow Effect

For `bitcoin_merchant` boards, add a subtle animated orange glow around the board container:

```css
.bitcoin-merchant-board {
  box-shadow: 0 0 20px rgba(247, 147, 26, 0.3),
              0 0 40px rgba(247, 147, 26, 0.1);
  animation: bitcoin-glow 3s ease-in-out infinite alternate;
}

@keyframes bitcoin-glow {
  from { box-shadow: 0 0 20px rgba(247, 147, 26, 0.2); }
  to { box-shadow: 0 0 30px rgba(247, 147, 26, 0.4); }
}
```

---

## 4. Seed Planted Feature

### 4.1 Database Schema

**New table: `seed_plantings`**
```sql
CREATE TABLE seed_plantings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  device_session_id UUID NOT NULL REFERENCES device_sessions(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('positive', 'neutral', 'negative')),
  commentary TEXT,  -- optional, max 280 chars
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One seed per device per location per day
  UNIQUE (device_session_id, location_id, (created_at::date))
);

-- Index for counting
CREATE INDEX idx_seed_plantings_location ON seed_plantings(location_id);

-- RLS
ALTER TABLE seed_plantings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON seed_plantings FOR ALL USING (true);
```

**New pin badge type:**
Add to the existing badge enum/validation:
```sql
-- If using CHECK constraint, update it:
-- badge IN ('question', 'announcement', 'offer', 'request', 'lost', 'found', 'event', 'seed')
```

### 4.2 API Endpoints

**`POST /api/seed/plant`**
```typescript
// Request
{
  presence_token: string;   // Required - must be at location
  outcome: 'positive' | 'neutral' | 'negative';
  commentary?: string;      // Max 280 chars
}

// Response
{
  success: boolean;
  seed_id: string;
  pin_id?: string;         // If commentary provided, creates a pin
  total_seeds: number;     // Updated count for location
}

// Validations:
// - Presence token required and valid
// - Location must be type 'merchant' (not bitcoin_merchant or community_space)
// - Max 1 seed per device per location per day
// - Commentary max 280 chars
```

**`GET /api/seed/count?location_id={id}`**
```typescript
// Response
{
  total: number;
  outcomes: {
    positive: number;
    neutral: number;
    negative: number;
  }
}
```

### 4.3 UI Components

**File:** Create `components/SeedPlantedButton.tsx`

Button only visible when:
- Feature flag `SEED_PLANTED` is enabled
- Location type is `merchant` (non-Bitcoin)
- User has valid presence token (physically present)
- User hasn't already planted seed today at this location

```tsx
// Button states:
// Default: "🌱 PLANT SEED" (prominent, orange-ish button)
// After planting: "✓ Seed Planted Today"
// Already planted: disabled, shows "✓ Seed Planted Today"
```

**File:** Create `components/SeedPlantedModal.tsx`

Modal flow:
1. "How did the conversation go?"
   - 😊 Positive - They seemed interested
   - 😐 Neutral - They listened but no commitment
   - 😕 Negative - Not interested right now

2. "Add a note? (optional)"
   - Textarea, 280 char max
   - Placeholder: "Share tips for the next person..."

3. Submit button: "Plant Seed 🌱"

**File:** Update `components/Board.tsx` (or create `components/SeedCounter.tsx`)

Display at top of board (below banner, if present):
```
🌱 47 people have asked this location to accept bitcoin.
[▼ Learn how to help]  ← Collapsible, links to /advocacy
```

### 4.4 Pin Badge for Seed Notes

When a seed is planted WITH commentary:
- Create a new pin with badge type `seed`
- Pin body = the commentary
- Style: Green-ish tint, 🌱 emoji badge icon
- Pin card should show outcome indicator subtly

---

## 5. Advocacy Page

**File:** Create `app/advocacy/page.tsx`

### Page Structure

```
/advocacy

# How to Orange-Pill Merchants

A friendly guide to helping local businesses discover Bitcoin.

## The Approach
- Be genuine and helpful, not pushy
- Start as a customer first
- Focus on benefits relevant to THEM

## Sample Scripts

### Opening Lines
- "Hey, I noticed you don't accept Bitcoin yet. Have you ever considered it?"
- "I love shopping here! Quick question - do you take Bitcoin?"
- "I'm trying to spend more Bitcoin locally. Any chance you'd consider accepting it?"

### If They're Curious
[Expandable section with talking points]

### Common Objections

**"It's too volatile"**
[Response script]

**"It's too complicated"**
[Response script]

**"We don't have the technical know-how"**
[Response script]

**"Our customers don't use it"**
[Response script]

## Resources
- [Link to BTCPay Server]
- [Link to simple guides]
- [Link to merchant success stories]

## Remember
- One conversation plants a seed
- Not every seed grows immediately
- Be patient, be kind, come back another day
```

### Footer Link
Add to site footer: "Advocacy Resources" → /advocacy

---

## 6. Feature Flag

**Flag name:** `SEED_PLANTED`

**Default:** `false` (disabled until ready)

**Controls:**
- Seed plant button visibility
- Seed counter display
- Advocacy page link in footer
- `seed` badge type availability

---

## 7. Map Pin Colors Update

Update map markers to use the new color scheme:

```typescript
const PIN_COLORS = {
  bitcoin_merchant: '#F7931A', // Orange
  merchant: '#6B7280',         // Gray
  community_space: '#3B82F6',  // Blue
  user_location: '#EF4444',    // Red (current user)
};
```

Update `components/LocationMap.tsx` and `components/ProximityMiniMap.tsx`.

---

## 8. Migration Checklist

1. [ ] Add `location_type` column to locations table
2. [ ] Create `seed_plantings` table
3. [ ] Add `seed` to pin badge types
4. [ ] Insert `SEED_PLANTED` feature flag (disabled)
5. [ ] Migrate existing locations:
   - `is_bitcoin_merchant = true` → `location_type = 'bitcoin_merchant'`
   - Others with `is_claimed = true` → `location_type = 'merchant'`

---

## 9. Files to Create/Modify

### New Files
- `app/advocacy/page.tsx`
- `components/BoardBanner.tsx`
- `components/SeedPlantedButton.tsx`
- `components/SeedPlantedModal.tsx`
- `components/SeedCounter.tsx`
- `app/api/seed/plant/route.ts`
- `app/api/seed/count/route.ts`
- `supabase/migrations/015_seed_planted_feature.sql`

### Modified Files
- `components/Board.tsx` - Add banner, counter, seed button
- `components/RequestLocationModal.tsx` - Add location type selector
- `components/LocationMap.tsx` - Update pin colors
- `components/ProximityMiniMap.tsx` - Update pin colors
- `types/index.ts` - Add new types
- `lib/featureFlags.ts` - Add SEED_PLANTED flag
- `app/api/location-request/route.ts` - Handle location_type
- Footer component - Add advocacy link

---

## 10. Type Definitions

```typescript
// types/index.ts additions

type LocationType = 'bitcoin_merchant' | 'merchant' | 'community_space';

type SeedOutcome = 'positive' | 'neutral' | 'negative';

interface SeedPlanting {
  id: string;
  location_id: string;
  device_session_id: string;
  outcome: SeedOutcome;
  commentary?: string;
  created_at: string;
}

interface SeedCount {
  total: number;
  outcomes: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

// Update Location interface
interface Location {
  // ... existing fields
  location_type: LocationType;
}

// Update Pin badge type
type PinBadge = 'question' | 'announcement' | 'offer' | 'request' | 'lost' | 'found' | 'event' | 'seed';
```

---

## Summary

This feature turns every non-Bitcoin merchant location into a coordinated advocacy opportunity. Users physically present at a location can log their conversations, share tips for future advocates, and see the cumulative effort of the community. The visual theming makes location types immediately clear, and the advocacy page provides resources to make conversations more effective.

**Energy:** Coordinated orange-pilling, not harassment. One ask per person per day. Helpful tips, not pressure tactics.
