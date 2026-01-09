import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

export async function DELETE(
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

    // Delete the pin
    const { error } = await supabaseAdmin
      .from('pins')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting pin:', error);
      return NextResponse.json({ error: 'Failed to delete pin' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete pin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
