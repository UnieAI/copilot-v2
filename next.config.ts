import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // ppr: true,
    serverActions: {
      allowedOrigins: [
        "https://multi-ai-chatroom.unieai.com"
      ]
    }
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
