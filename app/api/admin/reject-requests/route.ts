import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clickpin-admin-2024';

export async function POST(request: NextRequest) {
  // Check admin password
  const password = request.headers.get('X-Admin-Password');
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { request_ids } = await request.json();

    if (!request_ids?.length) {
      return NextResponse.json({ error: 'No request IDs provided' }, { status: 400 });
    }

    // Mark all requests as rejected
    const { error } = await supabaseAdmin
      .from('location_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
      })
      .in('id', request_ids);

    if (error) {
      console.error('Error rejecting requests:', error);
      return NextResponse.json({ error: 'Failed to reject requests' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reject requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
