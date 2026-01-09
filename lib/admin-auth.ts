import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, AdminUser } from './auth';

export type AdminAuthResult =
  | { authenticated: true; admin: AdminUser }
  | { authenticated: false; error: string };

/**
 * Verify admin authentication via Supabase Auth.
 */
export async function verifyAdminAuth(_request: NextRequest): Promise<AdminAuthResult> {
  const admin = await getAdminUser();
  if (admin) {
    return { authenticated: true, admin };
  }

  return { authenticated: false, error: 'Unauthorized' };
}

/**
 * Higher-order function to protect admin routes.
 * Usage: export const POST = requireAdmin(async (request, auth) => { ... });
 */
export function requireAdmin(
  handler: (request: NextRequest, auth: AdminAuthResult & { authenticated: true }) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const auth = await verifyAdminAuth(request);

    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return handler(request, auth as AdminAuthResult & { authenticated: true });
  };
}

/**
 * Check if the current request is from a super_admin.
 * Super admins have elevated permissions (e.g., managing other admins).
 */
export async function isSuperAdmin(_request: NextRequest): Promise<boolean> {
  const admin = await getAdminUser();
  if (!admin) return false;
  return admin.role === 'super_admin';
}
