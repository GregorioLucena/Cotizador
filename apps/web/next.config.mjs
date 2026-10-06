/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@cotizador/shared'],
  output: 'standalone',
};

export default nextConfig;
