import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const dummyPins = [
  // Alamo Drafthouse South Lamar
  { location_slug: 'alamo-south-lamar', body: 'Just saw the new Dune movie - absolutely incredible on this screen!', badge: 'Announcement' },
  { location_slug: 'alamo-south-lamar', body: 'Anyone know if they still have the chocolate cake? Best dessert in Austin', badge: 'Question' },
  { location_slug: 'alamo-south-lamar', body: 'Found a black umbrella in theater 3, left it at the front desk', badge: 'Found' },
  { location_slug: 'alamo-south-lamar', body: 'The sound system in theater 1 was having issues during the 7pm show', badge: null },

  // Torchy's Original
  { location_slug: 'torchys-original', body: 'The Trailer Park is still the GOAT taco. Fight me.', badge: null },
  { location_slug: 'torchys-original', body: 'Line is about 20 mins right now, worth the wait', badge: 'Announcement' },
  { location_slug: 'torchys-original', body: 'Secret menu tip: ask for the Matador with extra queso', badge: null },

  // Long Center
  { location_slug: 'long-center', body: 'Ballet Austin show tonight was phenomenal!', badge: 'Announcement' },
  { location_slug: 'long-center', body: 'Does anyone have an extra ticket for the 8pm show?', badge: 'Request' },
  { location_slug: 'long-center', body: 'The sunset views from the terrace are unreal tonight', badge: null },

  // Terry Black's BBQ
  { location_slug: 'terry-blacks', body: 'Brisket sold out at 1pm today, come early!', badge: 'Announcement' },
  { location_slug: 'terry-blacks', body: 'Best banana pudding in Austin, hands down', badge: null },
  { location_slug: 'terry-blacks', body: 'Line is moving fast today, maybe 30 min wait', badge: null },
  { location_slug: 'terry-blacks', body: 'Lost my sunglasses somewhere near the picnic tables', badge: 'Lost' },

  // Barton Springs
  { location_slug: 'barton-springs', body: 'Water is 68 degrees and perfect today!', badge: 'Announcement' },
  { location_slug: 'barton-springs', body: 'Spotted a huge turtle near the diving board', badge: null },
  { location_slug: 'barton-springs', body: 'Free yoga class starting on the hill in 30 mins', badge: 'Event' },
  { location_slug: 'barton-springs', body: 'Anyone want to split a locker? Mine has extra space', badge: 'Offer' },

  // Central Library
  { location_slug: 'central-library', body: 'The rooftop garden is open and beautiful today', badge: null },
  { location_slug: 'central-library', body: 'Free coding workshop in room 4A at 2pm', badge: 'Event' },
  { location_slug: 'central-library', body: 'The quiet study rooms on floor 6 are all taken', badge: null },

  // Congress Ave Bridge (Bat Bridge)
  { location_slug: 'bat-bridge', body: 'Bats should emerge around 8:15pm tonight!', badge: 'Announcement' },
  { location_slug: 'bat-bridge', body: 'Best viewing is from the kayaks if you can get one', badge: null },
  { location_slug: 'bat-bridge', body: 'There are literally thousands of bats right now!!', badge: null },

  // Whole Foods HQ
  { location_slug: 'whole-foods-hq', body: 'Rooftop bar has 50% off happy hour until 6pm', badge: 'Offer' },
  { location_slug: 'whole-foods-hq', body: 'The hot bar has the best chicken tikka today', badge: null },

  // ACL Live (Moody Theater)
  { location_slug: 'acl-live', body: 'Khruangbin show tonight is going to be incredible', badge: 'Event' },
  { location_slug: 'acl-live', body: 'Selling 2 tickets for tonight, face value', badge: 'Offer' },
  { location_slug: 'acl-live', body: 'Sound check happening now, sounds amazing!', badge: null },

  // Convention Center
  { location_slug: 'convention-center', body: 'SXSW badge pickup line is insane right now', badge: null },
  { location_slug: 'convention-center', body: 'Free swag at the Microsoft booth, hall C', badge: 'Offer' },

  // Bitcoin Park Austin
  { location_slug: 'littlefield-building-bitcoin-park-austin', body: 'Lightning Network workshop starting in 10 mins!', badge: 'Event' },
  { location_slug: 'littlefield-building-bitcoin-park-austin', body: 'Anyone want to grab coffee and talk Bitcoin?', badge: 'Request' },
];

async function run() {
  // First, get a device session to use (or create one)
  let session: { id: string } | null = null;

  const { data: existingSession, error: sessionError } = await supabase
    .from('device_sessions')
    .select('id')
    .limit(1)
    .single();

  if (sessionError || !existingSession) {
    // Create a dummy session
    const { data: newSession, error: createError } = await supabase
      .from('device_sessions')
      .insert({ user_agent: 'dummy-content-seeder' })
      .select()
      .single();

    if (createError) {
      console.error('Failed to create session:', createError.message);
      return;
    }
    session = newSession;
  } else {
    session = existingSession;
  }

  console.log('Using session:', session?.id);

  // Get all locations
  const { data: locations, error: locError } = await supabase
    .from('locations')
    .select('id, slug');

  if (locError) {
    console.error('Failed to get locations:', locError.message);
    return;
  }

  const locationMap = new Map(locations?.map(l => [l.slug, l.id]) || []);

  // Insert pins
  let inserted = 0;
  for (const pin of dummyPins) {
    const locationId = locationMap.get(pin.location_slug);
    if (!locationId) {
      console.log('Location not found:', pin.location_slug);
      continue;
    }

    const { error: insertError } = await supabase
      .from('pins')
      .insert({
        location_id: locationId,
        device_session_id: session?.id,
        body: pin.body,
        badge: pin.badge,
        is_hidden: false,
      });

    if (insertError) {
      console.error('Failed to insert pin:', insertError.message);
    } else {
      inserted++;
    }
  }

  console.log('Inserted', inserted, 'pins');
}

run();
