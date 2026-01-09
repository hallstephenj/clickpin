import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin auth (supports both Supabase and legacy password)
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Get current pin state
    const { data: pin, error: fetchError } = await supabaseAdmin
      .from('pins')
      .select('is_hidden')
      .eq('id', id)
      .single();

    if (fetchError || !pin) {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }

    // Toggle the hidden state
    const { error: updateError } = await supabaseAdmin
      .from('pins')
      .update({ is_hidden: !pin.is_hidden })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating pin:', updateError);
      return NextResponse.json({ error: 'Failed to update pin' }, { status: 500 });
    }

    return NextResponse.json({ success: true, is_hidden: !pin.is_hidden });
  } catch (error) {
    console.error('Toggle pin hidden error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
