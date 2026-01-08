import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pinId = searchParams.get('id');

    if (!pinId) {
      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#fafafa',
              fontFamily: 'system-ui',
            }}
          >
            <div style={{ fontSize: 48, color: '#666' }}>Pin not found</div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    // Fetch pin data
    const { data: pin } = await supabaseAdmin
      .from('pins')
      .select(`
        id,
        body,
        badge,
        deleted_at,
        is_hidden,
        locations (
          name,
          city
        )
      `)
      .eq('id', pinId)
      .is('parent_pin_id', null)
      .single();

    const location = pin?.locations as { name: string; city: string | null } | null;
    const locationText = location
      ? location.city
        ? `${location.name}, ${location.city}`
        : location.name
      : 'Unknown location';

    const isRemoved = pin?.deleted_at !== null || pin?.is_hidden;

    // Truncate body for display
    const bodyText = isRemoved
      ? 'This pin was removed'
      : pin?.body
        ? pin.body.length > 200
          ? pin.body.slice(0, 200) + '...'
          : pin.body
        : '';

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#fafafa',
            padding: 60,
            fontFamily: 'system-ui',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 40,
            }}
          >
            <span style={{ fontSize: 36, marginRight: 12 }}>&#x26A1;</span>
            <span style={{ fontSize: 32, fontWeight: 700, color: '#1a1a1a' }}>
              clickpin
            </span>
          </div>

          {/* Paper note card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              backgroundColor: '#f7f6f3',
              borderRadius: 8,
              padding: 48,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid rgba(100, 80, 50, 0.15)',
            }}
          >
            {/* Badge if present */}
            {!isRemoved && pin?.badge && (
              <div
                style={{
                  display: 'flex',
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#8a7a60',
                    backgroundColor: 'rgba(100, 80, 50, 0.08)',
                    padding: '4px 12px',
                    borderRadius: 4,
                  }}
                >
                  {pin.badge}
                </span>
              </div>
            )}

            {/* Body text */}
            <div
              style={{
                fontSize: isRemoved ? 32 : 40,
                lineHeight: 1.4,
                color: isRemoved ? '#999' : '#3d3d3d',
                flex: 1,
                fontStyle: isRemoved ? 'italic' : 'normal',
              }}
            >
              {bodyText}
            </div>

            {/* Location */}
            <div
              style={{
                fontSize: 24,
                color: '#8a7a60',
                marginTop: 32,
              }}
            >
              {locationText}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 32,
              fontSize: 20,
              color: '#999',
            }}
          >
            anonymous hyperlocal message board
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG image generation error:', error);
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fafafa',
            fontFamily: 'system-ui',
          }}
        >
          <div style={{ fontSize: 48, color: '#f7931a' }}>&#x26A1; clickpin</div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
