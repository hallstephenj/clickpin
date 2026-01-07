/**
 * Script to populate city field for existing locations using reverse geocoding
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." npx tsx scripts/populate-cities.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Free reverse geocoding using Nominatim (OpenStreetMap)
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: {
          'User-Agent': 'clickpin-city-populator/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error(`Geocoding failed for ${lat}, ${lng}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Try to get city from address components
    const address = data.address || {};
    const city = address.city || address.town || address.village || address.municipality || address.county;
    const state = address.state;

    if (city && state) {
      return `${city}, ${state}`;
    } else if (city) {
      return city;
    } else if (state) {
      return state;
    }

    return null;
  } catch (error) {
    console.error(`Geocoding error for ${lat}, ${lng}:`, error);
    return null;
  }
}

async function main() {
  console.log('Fetching locations without city...');

  const { data: locations, error } = await supabase
    .from('locations')
    .select('id, name, lat, lng, city')
    .is('city', null);

  if (error) {
    console.error('Error fetching locations:', error);
    process.exit(1);
  }

  if (!locations || locations.length === 0) {
    console.log('No locations need city population.');
    return;
  }

  console.log(`Found ${locations.length} locations to process.\n`);

  for (const location of locations) {
    console.log(`Processing: ${location.name} (${location.lat}, ${location.lng})`);

    // Rate limit: Nominatim requires 1 request per second
    await new Promise(resolve => setTimeout(resolve, 1100));

    const city = await reverseGeocode(location.lat, location.lng);

    if (city) {
      const { error: updateError } = await supabase
        .from('locations')
        .update({ city })
        .eq('id', location.id);

      if (updateError) {
        console.error(`  ❌ Failed to update: ${updateError.message}`);
      } else {
        console.log(`  ✓ Set city to: ${city}`);
      }
    } else {
      console.log(`  ⚠ Could not determine city`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
