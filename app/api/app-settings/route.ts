import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DesignTheme } from '@/types';

// Default settings
const DEFAULT_SETTINGS = {
  design_theme: 'mono' as DesignTheme,
};

// GET /api/app-settings - Public endpoint to fetch current app settings
export async function GET() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value');

    if (error) {
      console.error('Error fetching app settings:', error);
      return NextResponse.json({ settings: DEFAULT_SETTINGS });
    }

    // Convert array of key-value pairs to object
    const settingsMap = settings?.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>) || {};

    return NextResponse.json({
      settings: {
        design_theme: (settingsMap.design_theme as DesignTheme) || DEFAULT_SETTINGS.design_theme,
      },
    });
  } catch (error) {
    console.error('Error fetching app settings:', error);
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
  }
}
