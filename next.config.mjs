/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // Deployed natively on Vercel (Next.js App Router). Lint/type errors are
  // surfaced locally via `npm run lint` and `npx tsc --noEmit` rather than
  // blocking production builds.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
