/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@printing-store/core-logic"],
  output: 'standalone',
};

module.exports = nextConfig;
