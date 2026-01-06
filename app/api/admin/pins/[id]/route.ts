import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clickpin-admin-2024';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin password
  const password = request.headers.get('X-Admin-Password');
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
