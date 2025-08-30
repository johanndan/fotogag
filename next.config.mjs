import bundleAnalyzer from '@next/bundle-analyzer';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

initOpenNextCloudflareForDev();
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,                 
  outputFileTracingRoot: __dirname,  
  eslint: { ignoreDuringBuilds: process.env.SKIP_LINTER === 'true' },
  typescript: { ignoreBuildErrors: process.env.SKIP_LINTER === 'true' },
  compiler: { removeConsole: false }
};

export default withBundleAnalyzer(nextConfig);

