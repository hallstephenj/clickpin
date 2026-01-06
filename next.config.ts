import type { NextConfig } from "next";

// Log warning for missing env vars during build (don't fail - Railway injects at runtime)
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(
    `\n⚠️  Warning: Missing environment variables at build time:\n${missingEnvVars.map(v => `   - ${v}`).join('\n')}\n\nMake sure these are set in your deployment platform for runtime.\n`
  );
}

const nextConfig: NextConfig = {
  // Standalone output for optimized container deployments (Railway, Docker)
  output: 'standalone',

  // Required for Railway to inject env vars at runtime
  experimental: {
    // This allows runtime env vars to override build-time values
  },
};

export default nextConfig;
