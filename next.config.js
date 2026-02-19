/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configure dev server to ignore database files
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  // Configure webpack to ignore database files in watch mode
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Ignore database files and data directory
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/data/**',
          '**/*.db',
          '**/*.db-*',
          '**/*.db-journal',
          '**/*.db-wal',
          '**/*.db-shm'
        ]
      };
    }
    return config;
  },
}

module.exports = nextConfig
