import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { applyPaymentEffects } from '@/app/api/lightning/webhook/route';

// POST /api/dev/mark-paid - DEV ONLY: Mark an invoice as paid
export async function POST(request: NextRequest) {
  // Only allow in DEV mode
  if (!config.dev.enabled) {
    return NextResponse.json(
      { error: 'This endpoint is only available in DEV mode' },
      { status: 403 }
    );
  }

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
