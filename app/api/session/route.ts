import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// POST /api/session - Create or return a device session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const existingSessionId = body.session_id;
    const userAgent = request.headers.get('user-agent') || null;

    // If existing session ID provided, try to update last_seen
    if (existingSessionId) {
      const { data: existingSession, error: fetchError } = await supabaseAdmin
        .from('device_sessions')
        .select('id')
        .eq('id', existingSessionId)
        .single();

      if (!fetchError && existingSession) {
        // Update last_seen_at
        await supabaseAdmin
          .from('device_sessions')
          .update({ last_seen_at: new Date().toISOString(), user_agent: userAgent })
          .eq('id', existingSessionId);

        return NextResponse.json({ session_id: existingSessionId });
      }
    }

    // Create new session
    const newSessionId = uuidv4();
    const { error: insertError } = await supabaseAdmin.from('device_sessions').insert({
      id: newSessionId,
      user_agent: userAgent,
    });

    if (insertError) {
      console.error('Error creating session:', insertError);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json({ session_id: newSessionId });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
