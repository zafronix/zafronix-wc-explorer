/**
 * Next.js robots.txt generator.
 *
 * One real-world incident motivated this: GPTBot fired 12,580
 * requests against `/wc-explorer/compare/?years=…` overnight
 * (2026-05-18 → 2026-05-19) by enumerating year combinations.
 * Most of those were 9-year requests that 400'd against the
 * /compare API's 8-year cap — fixed client-side by chunking, but
 * the combinatorial crawl itself is still expensive on every
 * future crawl and adds zero indexing value (one /compare page
 * is enough; bots don't need every combination).
 *
 * We allow indexing of the canonical pages and disallow the
 * combinatorial trap.
 */
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Disallow the param-explosion URLs. Robots.txt globs aren't
        // fully standardized but * is widely supported by major bots
        // (GoogleBot, GPTBot, Bingbot, CCBot).
        disallow: [
          '/compare/*years=*', // combinatorial year-set URLs
        ],
      },
    ],
    sitemap: 'https://api.zafronix.com/wc-explorer/sitemap.xml',
  };
}
