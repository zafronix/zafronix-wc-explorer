/**
 * Next.js robots.txt generator.
 *
 * THREE classes of rules:
 *
 *  1. Blocked SEO crawlers — pure resource cost, no value to us.
 *     Semrush, MJ12, DotBot, etc. They generally honor robots.txt.
 *
 *  2. Blocked AI training crawlers — opt out of LLM training data.
 *     GPTBot, MetaAgent, CohereBot, DeepSeekBot, MistralBot.
 *     These are SEPARATE from agentic / search bots (ChatGPT-User,
 *     OAI-SearchBot, facebookexternalhit, Applebot) that DO drive
 *     real product traffic — those stay allowed.
 *
 *  3. Default rule — allow indexing of canonical pages, disallow
 *     the /compare?years= combinatorial trap that one GPTBot run
 *     hammered with 12,580 requests on 2026-05-18.
 *
 * Non-compliant bots get a hard nginx-level 403 (see deploy/
 * blocked-bots.nginx.conf).
 */
import type { MetadataRoute } from 'next';

const BLOCKED_BOTS = [
  // SEO / backlink crawlers (no value, pure resource consumption)
  'SemrushBot',
  'DotBot',
  'MJ12bot',
  'AwarioBot',
  'SERankingBacklinksBot',
  'ReadBot',
  'wpbot',
  'RecordedFuture',

  // Aggressive crawlers with little benefit
  'Bytespider',
  'Amazonbot',

  // AI training crawlers (separate from agentic / live-search bots
  // which still drive real product traffic — those stay allowed)
  'GPTBot',
  'Meta-ExternalAgent',
  'meta-externalagent',
  'meta-externalads',
  'CohereBot',
  'DeepSeekBot',
  'MistralBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...BLOCKED_BOTS.map((userAgent) => ({
        userAgent,
        disallow: '/',
      })),
      {
        userAgent: '*',
        allow: '/',
        // Disallow the param-explosion URLs. Robots.txt globs aren't
        // fully standardized but * is widely supported by major bots
        // (GoogleBot, GPTBot, Bingbot, CCBot).
        disallow: [
          '/compare/*years=*',
        ],
      },
    ],
    sitemap: 'https://api.zafronix.com/wc-explorer/sitemap.xml',
  };
}
