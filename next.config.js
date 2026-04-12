/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow local public images and Supabase storage
    domains: ['your-supabase-project.supabase.co'],
    // Disable optimization for local public assets to prevent loading issues
    unoptimized: true,
  },
};

module.exports = nextConfig;
