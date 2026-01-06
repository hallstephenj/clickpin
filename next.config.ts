import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for optimized container deployments (Railway, Docker)
  output: 'standalone',
};

export default nextConfig;
