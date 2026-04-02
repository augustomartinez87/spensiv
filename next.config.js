/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    serverComponentsExternalPackages: ['@vercel/blob'],
  },
}

module.exports = nextConfig
