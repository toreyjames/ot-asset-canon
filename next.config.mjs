/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence warnings about @anthropic-ai/sdk
  serverExternalPackages: ['@anthropic-ai/sdk'],
};

export default nextConfig;
