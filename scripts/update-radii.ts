import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Radius assignments based on location type/size
const radiusUpdates: Record<string, number> = {
  // Airports - very large
  'Austin-Bergstrom International Airport': 800,

  // Large parks, race tracks
  'Zilker Park': 600,
  'Circuit of the Americas': 700,

  // Entertainment districts - cover the whole area
  '6th Street (Downtown)': 400,
  'The Domain': 500,
  'South Congress Avenue': 350,
  'Rainey Street': 250,

  // Stadiums
  'Darrell K Royal-Texas Memorial Stadium': 400,
  'Q2 Stadium': 350,

  // Large venues/areas
  'Austin Convention Center': 300,
  'Texas State Capitol': 300, // Includes grounds
  'Lady Bird Lake Trail': 400, // Long trail
  'Mueller Lake Park': 300,
  'UT Austin Main Mall': 250,

  // Medium outdoor areas
  'Barton Springs Pool': 250,
  'Mount Bonnell': 200,
  'Pennybacker Bridge (360 Bridge)': 200,
  'East Austin Hope Outdoor Gallery': 150,

  // Individual buildings - museums, theaters, libraries
  'Littlefield Building // Bitcoin Park Austin': 100,
  'Austin Central Library': 150,
  'Blanton Museum of Art': 150,
  'Bullock Texas State History Museum': 150,
  'Long Center for the Performing Arts': 175,
  'Moody Theater (ACL Live)': 150,
  'UT Tower': 150,
  'Whole Foods Market HQ': 150,
  'Alamo Drafthouse South Lamar': 125,

  // Congress Avenue Bridge - narrow
  'Congress Avenue Bridge (Bat Bridge)': 150,

  // Restaurants - small footprint
  'Franklin Barbecue': 75,
  'Terry Black\'s BBQ': 100,
  'Torchy\'s Tacos (Original)': 75,
  'Chipotle Georgetown': 75,

  // Unknown/generic - keep reasonable
  'Fairways': 200,
  'Halls': 150,
  'Arnott Inc': 150,
};

async function run() {
  console.log('Updating location radii...\n');

  for (const [name, radius] of Object.entries(radiusUpdates)) {
    const { data, error } = await supabase
      .from('locations')
      .update({ radius_m: radius })
      .eq('name', name)
      .select('name, radius_m')
      .single();

    if (error) {
      console.log(`❌ ${name}: ${error.message}`);
    } else if (data) {
      console.log(`✓ ${name}: ${radius}m`);
    } else {
      console.log(`⚠ ${name}: not found`);
    }
  }

  console.log('\nDone!');
}

run();
