#!/usr/bin/env node

/**
 * Runtime environment variable validation
 * Run this before starting the server to ensure required vars are set
 */

const requiredEnvVars = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', alt: 'SUPABASE_URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', alt: 'SUPABASE_ANON_KEY' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY' },
];

const missing = [];

for (const { name, alt } of requiredEnvVars) {
  const value = process.env[name] || (alt ? process.env[alt] : undefined);
  if (!value) {
    missing.push(alt ? `${name} (or ${alt})` : name);
  }
}

if (missing.length > 0) {
  console.error('\n❌ Missing required environment variables:\n');
  missing.forEach((v) => console.error(`   - ${v}`));
  console.error('\nPlease set these in your deployment platform (Railway, Vercel, etc.).\n');
  process.exit(1);
}

console.log('✓ Environment variables validated');
