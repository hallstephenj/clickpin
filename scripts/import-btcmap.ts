/**
 * Import Bitcoin-accepting locations from BTCMap API
 * Usage: NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/import-btcmap.ts --lat=30.2672 --lon=-97.7431 --radius=50
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BTCMapPlace {
  id: number;
  lat: number;
  lon: number;
  name: string;
  icon?: string;
  address?: string;
  website?: string;
  phone?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function getCategory(place: BTCMapPlace): string {
  const icon = place.icon || '';

  // Map BTCMap icons to clickpin categories
  if (['restaurant', 'lunch_dining', 'local_pizza', 'cake'].includes(icon)) return 'food';
  if (['local_cafe'].includes(icon)) return 'cafe';
  if (['local_bar', 'nightlife'].includes(icon)) return 'bar';
  if (['hotel'].includes(icon)) return 'hospitality';
  if (['storefront', 'local_florist'].includes(icon)) return 'retail';
  if (['group', 'groups', 'business'].includes(icon)) return 'office';
  if (['fitness_center', 'sports', 'pedal_bike'].includes(icon)) return 'fitness';
  if (['medical_services', 'spa'].includes(icon)) return 'health';
  if (['content_cut'].includes(icon)) return 'services';
  if (['colorize'].includes(icon)) return 'services';

  return 'bitcoin'; // Default category for BTC-accepting locations
}

async function fetchBTCMapLocations(lat: number, lon: number, radiusKm: number): Promise<BTCMapPlace[]> {
  // BTCMap v4 API with geographic search
  const url = `https://api.btcmap.org/v4/places/search?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`;

  console.log(`Fetching from BTCMap v4 API...`);
  console.log(`URL: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`BTCMap API error: ${response.status}`);
  }

  const places: BTCMapPlace[] = await response.json();
  console.log(`Found ${places.length} places within ${radiusKm}km of (${lat}, ${lon})`);

  return places;
}

async function importLocations(lat: number, lon: number, radiusKm: number, dryRun: boolean = false) {
  const places = await fetchBTCMapLocations(lat, lon, radiusKm);

  // Get existing locations to check for duplicates
  const { data: existing } = await supabase
    .from('locations')
    .select('slug, lat, lng');

  const existingSlugs = new Set(existing?.map(l => l.slug) || []);
  const existingCoords = new Set(existing?.map(l => `${l.lat.toFixed(5)},${l.lng.toFixed(5)}`) || []);

  let created = 0;
  let skipped = 0;

  for (const place of places) {
    if (!place.name) {
      console.log(`Skipping place ${place.id}: no name`);
      skipped++;
      continue;
    }

    const coordKey = `${place.lat.toFixed(5)},${place.lon.toFixed(5)}`;

    // Check for duplicate by coordinates
    if (existingCoords.has(coordKey)) {
      console.log(`Skipping "${place.name}": duplicate coordinates`);
      skipped++;
      continue;
    }

    // Generate unique slug
    let baseSlug = slugify(place.name);
    let slug = baseSlug;
    let counter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const category = getCategory(place);

    const location = {
      name: place.name,
      slug,
      lat: place.lat,
      lng: place.lon,
      radius_m: 100, // 100m radius for retail locations
      is_active: true,
      category,
    };

    if (dryRun) {
      console.log(`[DRY RUN] Would create: ${place.name} (${slug}) at ${place.lat}, ${place.lon} [${category}]`);
    } else {
      const { error } = await supabase.from('locations').insert(location);
      if (error) {
        console.error(`Failed to create "${place.name}": ${error.message}`);
      } else {
        console.log(`Created: ${place.name} (${slug}) [${category}]`);
        existingSlugs.add(slug);
        existingCoords.add(coordKey);
        created++;
      }
    }
  }

  console.log(`\nSummary: ${created} created, ${skipped} skipped`);
}

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg?.split('=')[1];
};

const lat = parseFloat(getArg('lat') || '30.2672'); // Default: Austin
const lon = parseFloat(getArg('lon') || '-97.7431');
const radius = parseFloat(getArg('radius') || '25'); // Default: 25km
const dryRun = args.includes('--dry-run');

console.log(`\nBTCMap Import Script`);
console.log(`====================`);
console.log(`Center: ${lat}, ${lon}`);
console.log(`Radius: ${radius}km`);
console.log(`Dry run: ${dryRun}\n`);

importLocations(lat, lon, radius, dryRun).catch(console.error);
