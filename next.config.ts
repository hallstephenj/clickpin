import type { NextConfig } from "next";

// Validate required environment variables at build time
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `\n\n❌ Missing required environment variables:\n${missingEnvVars.map(v => `   - ${v}`).join('\n')}\n\nPlease set these in your deployment platform (Railway, Vercel, etc.) before building.\n`
  );
}

const nextConfig: NextConfig = {
  // Standalone output for optimized container deployments (Railway, Docker)
  output: 'standalone',
};

export default nextConfig;
