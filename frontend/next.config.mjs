/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    'tunnel.example.com',
    '*.tunnel.example.com',
    'local-origin.dev',
    '*.local-origin.dev',
  ],
};

export default nextConfig;
