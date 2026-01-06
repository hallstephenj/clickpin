import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Location {
  name: string;
  slug: string;
  category: string;
  lat: number;
  lng: number;
  radius_m: number;
}

async function seed() {
  console.log('Starting seed process...');

  // Read locations from JSON file
  const locationsPath = path.join(__dirname, 'austin-locations.json');
  const locationsData = fs.readFileSync(locationsPath, 'utf-8');
  const locations: Location[] = JSON.parse(locationsData);

  console.log(`Found ${locations.length} locations to seed`);

  // Insert locations
  for (const location of locations) {
    const { data, error } = await supabase
      .from('locations')
      .upsert(
        {
          name: location.name,
          slug: location.slug,
          category: location.category,
          lat: location.lat,
          lng: location.lng,
          radius_m: location.radius_m,
          is_active: true,
        },
        {
          onConflict: 'slug',
        }
      )
      .select();

    if (error) {
      console.error(`Error inserting ${location.name}:`, error.message);
    } else {
      console.log(`✓ ${location.name}`);
    }
  }

  console.log('\nSeed complete!');
}

seed().catch(console.error);
