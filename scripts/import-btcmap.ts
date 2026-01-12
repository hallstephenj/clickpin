/**
 * BTCMap Location Import/Sync Script
 *
 * Commands:
 *   import  - Import new locations from BTCMap (default)
 *   sync    - Update existing locations with latest BTCMap data
 *   delete  - Delete all BTCMap-sourced locations
 *   list    - List current BTCMap locations in database
 *
 * Usage:
 *   npx tsx scripts/import-btcmap.ts import --lat=30.2672 --lon=-97.7431 --radius=50
 *   npx tsx scripts/import-btcmap.ts sync
 *   npx tsx scripts/import-btcmap.ts delete --confirm
 *   npx tsx scripts/import-btcmap.ts list
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
  opening_hours?: string;
  osm_id?: string;
  verified_at?: string;
  updated_at?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function getCategory(icon: string): string {
  const categoryMap: Record<string, string> = {
    // Food & Drink
    'restaurant': 'food',
    'lunch_dining': 'food',
    'local_pizza': 'food',
    'cake': 'food',
    'local_cafe': 'cafe',
    'local_bar': 'bar',
    'nightlife': 'bar',
    // Retail
    'storefront': 'retail',
    'local_florist': 'retail',
    'local_printshop': 'retail',
    // Services
    'content_cut': 'services',
    'colorize': 'services',
    'cleaning_services': 'services',
    'construction': 'services',
    'grass': 'services',
    // Health & Fitness
    'medical_services': 'health',
    'spa': 'health',
    'fitness_center': 'fitness',
    'sports': 'fitness',
    'pedal_bike': 'fitness',
    // Business
    'group': 'coworking',
    'groups': 'coworking',
    'business': 'business',
    // Other
    'hotel': 'hospitality',
  };

  return categoryMap[icon] || 'bitcoin';
}

async function fetchBTCMapLocations(lat: number, lon: number, radiusKm: number): Promise<BTCMapPlace[]> {
  const url = `https://api.btcmap.org/v4/places/search?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`;

  console.log(`Fetching from BTCMap v4 API...`);
  console.log(`URL: ${url}\n`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`BTCMap API error: ${response.status}`);
  }

  const places: BTCMapPlace[] = await response.json();
  console.log(`Found ${places.length} places within ${radiusKm}km\n`);

  return places;
}

async function importLocations(lat: number, lon: number, radiusKm: number, cityName: string, dryRun: boolean) {
  const places = await fetchBTCMapLocations(lat, lon, radiusKm);

  // Get existing BTCMap IDs to avoid duplicates
  const { data: existing } = await supabase
    .from('locations')
    .select('btcmap_id, slug');

  const existingBtcmapIds = new Set(existing?.filter(l => l.btcmap_id).map(l => l.btcmap_id) || []);
  const existingSlugs = new Set(existing?.map(l => l.slug) || []);

  let created = 0;
  let skipped = 0;

  for (const place of places) {
    if (!place.name) {
      skipped++;
      continue;
    }

    // Skip if already imported
    if (existingBtcmapIds.has(place.id)) {
      console.log(`Skipping "${place.name}": already imported (btcmap_id: ${place.id})`);
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

    const category = getCategory(place.icon || '');

    const location = {
      name: place.name,
      slug,
      lat: place.lat,
      lng: place.lon,
      radius_m: 50,
      is_active: true,
      category,
      city: cityName,
      // BTCMap fields
      btcmap_id: place.id,
      osm_id: place.osm_id,
      address: place.address,
      phone: place.phone,
      website: place.website,
      opening_hours: place.opening_hours,
      btcmap_icon: place.icon,
      btcmap_verified_at: place.verified_at,
      btcmap_updated_at: place.updated_at,
    };

    if (dryRun) {
      console.log(`[DRY RUN] Would create: ${place.name} (${slug}) [${category}]`);
    } else {
      const { error } = await supabase.from('locations').insert(location);
      if (error) {
        console.error(`Failed to create "${place.name}": ${error.message}`);
      } else {
        console.log(`Created: ${place.name} (${slug}) [${category}]`);
        existingSlugs.add(slug);
        existingBtcmapIds.add(place.id);
        created++;
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`Summary: ${created} created, ${skipped} skipped`);
}

async function syncLocations() {
  // Get all BTCMap locations from our database
  const { data: locations, error } = await supabase
    .from('locations')
    .select('id, btcmap_id, name')
    .not('btcmap_id', 'is', null);

  if (error || !locations) {
    console.error('Failed to fetch locations:', error?.message);
    return;
  }

  console.log(`Found ${locations.length} BTCMap locations to sync\n`);

  let updated = 0;
  for (const loc of locations) {
    // Fetch latest from BTCMap
    const response = await fetch(`https://api.btcmap.org/v4/places/${loc.btcmap_id}`);
    if (!response.ok) {
      console.log(`Failed to fetch btcmap_id ${loc.btcmap_id}: ${response.status}`);
      continue;
    }

    const place: BTCMapPlace = await response.json();

    // Update our record
    const { error: updateError } = await supabase
      .from('locations')
      .update({
        name: place.name,
        address: place.address,
        phone: place.phone,
        website: place.website,
        opening_hours: place.opening_hours,
        btcmap_icon: place.icon,
        btcmap_verified_at: place.verified_at,
        btcmap_updated_at: place.updated_at,
        category: getCategory(place.icon || ''),
      })
      .eq('id', loc.id);

    if (updateError) {
      console.error(`Failed to update "${loc.name}": ${updateError.message}`);
    } else {
      console.log(`Updated: ${loc.name}`);
      updated++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Synced ${updated} locations`);
}

async function deleteLocations(confirm: boolean) {
  if (!confirm) {
    console.log('Use --confirm to actually delete locations');
    return;
  }

  // First delete all pins at BTCMap locations
  const { data: locations } = await supabase
    .from('locations')
    .select('id')
    .not('btcmap_id', 'is', null);

  if (locations && locations.length > 0) {
    const locationIds = locations.map(l => l.id);

    // Delete pins
    const { error: pinsError } = await supabase
      .from('pins')
      .delete()
      .in('location_id', locationIds);

    if (pinsError) {
      console.error('Failed to delete pins:', pinsError.message);
    } else {
      console.log(`Deleted pins from ${locations.length} locations`);
    }
  }

  // Delete BTCMap locations
  const { error, count } = await supabase
    .from('locations')
    .delete({ count: 'exact' })
    .not('btcmap_id', 'is', null);

  if (error) {
    console.error('Failed to delete locations:', error.message);
  } else {
    console.log(`Deleted ${count} BTCMap locations`);
  }
}

async function deleteAllLocations(confirm: boolean) {
  if (!confirm) {
    console.log('Use --confirm to actually delete ALL locations');
    return;
  }

  // First delete all pins
  const { error: pinsError } = await supabase
    .from('pins')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (pinsError) {
    console.error('Failed to delete pins:', pinsError.message);
  } else {
    console.log('Deleted all pins');
  }

  // Delete all locations
  const { error, count } = await supabase
    .from('locations')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (error) {
    console.error('Failed to delete locations:', error.message);
  } else {
    console.log(`Deleted ${count} locations`);
  }
}

async function listLocations() {
  const { data, error } = await supabase
    .from('locations')
    .select('name, slug, category, btcmap_id, address')
    .order('name');

  if (error) {
    console.error('Failed to list locations:', error.message);
    return;
  }

  console.log(`\nCurrent locations (${data?.length || 0}):\n`);
  data?.forEach(loc => {
    const btcmap = loc.btcmap_id ? `[BTCMap #${loc.btcmap_id}]` : '[Manual]';
    console.log(`  ${loc.name} (${loc.slug}) [${loc.category}] ${btcmap}`);
    if (loc.address) console.log(`    ${loc.address}`);
  });
}

// Parse CLI args
const args = process.argv.slice(2);
const command = args[0] || 'import';
const getArg = (name: string): string | undefined => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg?.split('=')[1];
};

const lat = parseFloat(getArg('lat') || '30.2672'); // Austin default
const lon = parseFloat(getArg('lon') || '-97.7431');
const radius = parseFloat(getArg('radius') || '50');
const city = getArg('city') || 'Austin';
const dryRun = args.includes('--dry-run');
const confirm = args.includes('--confirm');

console.log(`\n╔═══════════════════════════════════════╗`);
console.log(`║  BTCMap Location Manager              ║`);
console.log(`╚═══════════════════════════════════════╝\n`);
console.log(`Command: ${command}`);
if (command === 'import') {
  console.log(`Center: ${lat}, ${lon}`);
  console.log(`Radius: ${radius}km`);
  console.log(`City: ${city}`);
  console.log(`Dry run: ${dryRun}\n`);
}

switch (command) {
  case 'import':
    importLocations(lat, lon, radius, city, dryRun).catch(console.error);
    break;
  case 'sync':
    syncLocations().catch(console.error);
    break;
  case 'delete':
    deleteLocations(confirm).catch(console.error);
    break;
  case 'delete-all':
    deleteAllLocations(confirm).catch(console.error);
    break;
  case 'list':
    listLocations().catch(console.error);
    break;
  default:
    console.log(`Unknown command: ${command}`);
    console.log(`Available commands: import, sync, delete, delete-all, list`);
}
