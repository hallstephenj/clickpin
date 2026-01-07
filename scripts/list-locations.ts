import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, slug, city, lat, lng, radius_m')
    .order('name');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Current Locations:\n');
  data.forEach(loc => {
    const city = loc.city || 'no city';
    console.log(`- ${loc.name} (${city}): radius=${loc.radius_m}m`);
  });
}

run();
