import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { DesignTheme } from '@/types';

const VALID_THEMES: DesignTheme[] = ['mono', 'forstall', 'neo2026'];

// GET /api/admin/app-settings - Get all settings with full details
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { data: settings, error } = await supabaseAdmin
      .from('app_settings')
      .select('*')
      .order('key');

    if (error) {
      console.error('Error fetching app settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching app settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/app-settings - Update a setting
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || !value) {
      return NextResponse.json({ error: 'Key and value required' }, { status: 400 });
    }

    // Validate design_theme values
    if (key === 'design_theme' && !VALID_THEMES.includes(value as DesignTheme)) {
      return NextResponse.json({ error: 'Invalid theme value' }, { status: 400 });
    }

    const { data: setting, error } = await supabaseAdmin
      .from('app_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key)
      .select()
      .single();

    if (error) {
      console.error('Error updating app setting:', error);
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
    }

    return NextResponse.json({ setting });
  } catch (error) {
    console.error('Error updating app setting:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
