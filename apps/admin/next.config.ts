import type { NextConfig } from 'next';

const allowedImageHosts = (process.env.NEXT_IMAGE_ALLOWED_HOSTS || 'wisesama.com,assets.wisesama.com')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  transpilePackages: ['@wisesama/types'],
  images: {
    remotePatterns: allowedImageHosts.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
};

export default nextConfig;
