import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_ADMIN_PASSWORD = 'clickpin-admin-2024';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // Read at runtime to ensure env var is available in standalone mode
    const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

    if (password === adminPassword) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
