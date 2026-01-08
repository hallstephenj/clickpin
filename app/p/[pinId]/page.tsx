import { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { SharedPinView } from '@/components/SharedPinView';
import { Lightning } from '@phosphor-icons/react';

interface PageProps {
  params: Promise<{ pinId: string }>;
}

// Fetch pin data for metadata and page
async function getPinData(pinId: string) {
  const flags = await getFeatureFlags();
  if (!flags.SHARENOTES) {
    return null;
  }

  const { data: pin, error: pinError } = await supabaseAdmin
    .from('pins')
    .select(`
      id,
      body,
      doodle_data,
      badge,
      created_at,
      deleted_at,
      is_hidden,
      location_id,
      locations (
        id,
        name,
        city,
        slug,
        lat,
        lng
      )
    `)
    .eq('id', pinId)
    .is('parent_pin_id', null)
    .single();

  if (pinError || !pin) {
    return null;
  }

  const isRemoved = pin.deleted_at !== null || pin.is_hidden;

  const { count: replyCount } = await supabaseAdmin
    .from('pins')
    .select('*', { count: 'exact', head: true })
    .eq('parent_pin_id', pinId)
    .is('deleted_at', null)
    .eq('is_hidden', false);

  const { count: locationPinCount } = await supabaseAdmin
    .from('pins')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', pin.location_id)
    .is('parent_pin_id', null)
    .is('deleted_at', null)
    .eq('is_hidden', false);

  type LocationData = {
    id: string;
    name: string;
    city: string | null;
    slug: string;
    lat: number;
    lng: number;
  };
  const locationData = pin.locations as unknown as LocationData | LocationData[];
  const location = Array.isArray(locationData) ? locationData[0] : locationData;

  return {
    pin: isRemoved ? null : {
      id: pin.id,
      body: pin.body,
      doodle_data: pin.doodle_data,
      badge: pin.badge,
      created_at: pin.created_at,
    },
    isRemoved,
    replyCount: replyCount || 0,
    location,
    locationPinCount: locationPinCount || 0,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pinId } = await params;
  const data = await getPinData(pinId);

  if (!data) {
    return {
      title: 'Pin not found | clickpin',
      description: 'This pin could not be found.',
    };
  }

  const { pin, isRemoved, location } = data;

  const locationText = location.city
    ? `${location.name}, ${location.city}`
    : location.name;

  if (isRemoved) {
    return {
      title: `Pin from ${locationText} | clickpin`,
      description: 'This pin was removed. clickpin is an anonymous, hyperlocal message board.',
      openGraph: {
        title: `Pin from ${locationText}`,
        description: 'This pin was removed. clickpin is an anonymous, hyperlocal message board.',
        images: [`/api/og/pin?id=${pinId}`],
      },
      twitter: {
        card: 'summary_large_image',
        title: `Pin from ${locationText}`,
        description: 'This pin was removed. clickpin is an anonymous, hyperlocal message board.',
        images: [`/api/og/pin?id=${pinId}`],
      },
    };
  }

  // Truncate body for description
  const bodyPreview = pin!.body.length > 120
    ? pin!.body.slice(0, 120) + '...'
    : pin!.body;

  return {
    title: `${locationText} | clickpin`,
    description: bodyPreview,
    openGraph: {
      title: `${locationText}`,
      description: bodyPreview,
      images: [`/api/og/pin?id=${pinId}`],
      siteName: 'clickpin',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${locationText}`,
      description: bodyPreview,
      images: [`/api/og/pin?id=${pinId}`],
    },
  };
}

export default async function SharedPinPage({ params }: PageProps) {
  const { pinId } = await params;
  const data = await getPinData(pinId);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a]">
        {/* Header */}
        <header className="border-b border-[var(--border)]">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 hover:opacity-80">
              <Lightning size={20} weight="fill" className="text-[#f7931a]" />
              <span className="font-bold">clickpin</span>
            </a>
            <a href="/about" className="btn">
              what is this?
            </a>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🔍</div>
            <h1 className="text-xl font-bold mb-2">pin not found</h1>
            <p className="text-[var(--fg-muted)] text-sm mb-6">
              this pin doesn&apos;t exist or sharing is not enabled.
            </p>
            <a href="/" className="btn btn-primary">
              go to clickpin
            </a>
          </div>

          {/* Still show what clickpin is */}
          <section className="mt-12">
            <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
              what is clickpin?
            </h2>
            <div className="space-y-3 text-[var(--fg-muted)]">
              <p>
                clickpin is an anonymous, hyperlocal message board. posts are tied to
                physical locations — you can only see and create posts when you&apos;re
                actually there.
              </p>
              <p>
                no accounts, no followers, no algorithms. just posts from people who
                have been where you are.
              </p>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-[var(--border)] mt-8">
          <div className="max-w-2xl mx-auto px-4 py-6 flex justify-center gap-6 text-xs text-faint">
            <a href="/map" className="hover:text-[var(--fg-muted)] transition-colors">nearby</a>
            <a href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</a>
            <a href="/terms" className="hover:text-[var(--fg-muted)] transition-colors">terms</a>
            <a href="/privacy" className="hover:text-[var(--fg-muted)] transition-colors">privacy</a>
          </div>
        </footer>
      </div>
    );
  }

  return <SharedPinView data={data} />;
}
