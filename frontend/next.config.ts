import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // avoid double-renders in dev
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react', 'ethers'],
  },
};

export default nextConfig;
