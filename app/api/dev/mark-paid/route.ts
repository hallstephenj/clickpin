import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { applyPaymentEffects } from '@/app/api/lightning/webhook/route';

// POST /api/dev/mark-paid - DEV ONLY: Mark an invoice as paid
export async function POST(request: NextRequest) {
  // SECURITY: Multiple layers of protection for this dangerous endpoint

  // 1. Only allow in DEV mode
  if (!config.dev.enabled) {
    return NextResponse.json(
      { error: 'This endpoint is only available in DEV mode' },
      { status: 403 }
    );
  }

  // 2. Only allow from localhost in development
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const clientIp = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

  const isLocalhost = clientIp === '127.0.0.1' ||
                      clientIp === '::1' ||
                      clientIp === 'localhost' ||
                      clientIp === 'unknown'; // Allow if behind proxy without headers

  if (!isLocalhost && process.env.NODE_ENV === 'production') {
    console.error(`[SECURITY] Dev endpoint accessed from non-localhost IP: ${clientIp}`);
    return NextResponse.json(
      { error: 'This endpoint is only available from localhost' },
      { status: 403 }
    );
  }

  // Log usage for audit
  console.warn(`[DEV] mark-paid endpoint used from IP: ${clientIp}`);

  try {
    const body = await request.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    // Apply payment effects using the same logic as the webhook
    const result = await applyPaymentEffects(invoice_id);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      type: result.type,
      message: `Payment for ${result.type} invoice marked as paid`,
    });
  } catch (error) {
    console.error('Dev mark-paid error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
