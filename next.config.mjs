/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Uploads de vídeo podem ser grandes; o limite real também está em MIX_MAX_BYTES.
  experimental: {
    serverActions: {
      bodySizeLimit: '120mb',
    },
  },
}

export default nextConfig
