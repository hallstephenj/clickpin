import { NextRequest, NextResponse } from 'next/server';
import { generateK1, createLnurlAuth, decodeLnurl } from '@/lib/lnurl';

/**
 * GET /api/lnurl/debug
 * Debug endpoint to test LNURL generation and decoding
 */
export async function GET(request: NextRequest) {
  const testK1 = generateK1();
  const lnurl = createLnurlAuth(testK1);
  const decodedUrl = decodeLnurl(lnurl);

  return NextResponse.json({
    k1: testK1,
    lnurl: lnurl,
    decoded_url: decodedUrl,
    base_url: process.env.NEXT_PUBLIC_BASE_URL || 'not set',
  });
}
