import type { NextConfig } from 'next';

/**
 * Next config for the WC API data explorer.
 *
 * Mounted at api.zafronix.com/wc-explorer via nginx, so basePath is
 * '/wc-explorer'. Trailing slash matches the admin convention to keep
 * nginx + Next.js redirects in sync.
 *
 * Internal-rendered showcase — public, indexable, but no auth gates.
 */
const config: NextConfig = {
  basePath: '/wc-explorer',
  trailingSlash: true,
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default config;
