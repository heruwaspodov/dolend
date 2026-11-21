import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const config = (phase: string): NextConfig => ({
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  ...(phase === PHASE_DEVELOPMENT_SERVER && {
    rewrites: async () => [{ source: '/d/:code', destination: '/event/' }],
  }),
});
export default config;
