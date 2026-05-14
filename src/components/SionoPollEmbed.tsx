/**
 * SionoPollEmbed — server-rendered poll widget.
 *
 * Renders the poll question + options as semantic HTML so crawlers and
 * screen readers see it without a JS round-trip. The vote interaction
 * itself is handled by the `SionoPollVote` hydration island.
 *
 * Two modes:
 *   - context — pass `context={{ matchId, teamId, … }}` and the
 *     component asks siono "what poll should we show here?" Returns
 *     null (renders nothing) on 204 No Content.
 *   - pinned  — pass `pollId="…"` to render a specific poll
 *     regardless of context. Useful for editorial overrides.
 *
 * Renders nothing on siono outage / 204 / unknown id. Page layout
 * mustn't depend on this widget being present.
 *
 * Usage:
 *   <SionoPollEmbed context={{ tournament: 'wc-2026' }} />
 *   <SionoPollEmbed pollId="embed_abc123" />
 */

import { fetchEmbedPollByContext, fetchEmbedPollById } from '@/lib/siono-embed';
import type { LookupContext } from '@/lib/siono-embed';
import { SionoPollVote } from './SionoPollVote';

/**
 * Render mode controls how the poll appears in-page. Pick per page
 * type — the operator-side poll data is identical across modes.
 *
 *   inline (default) — fully SSR'd in WC Explorer styling. Question +
 *     options are in the DOM as semantic HTML; vote interaction is
 *     hydrated by SionoPollVote. Best for high-context pages (a
 *     tournament hub, a match preview) where the poll should feel
 *     native to the page.
 *
 *   iframe — embed siono.app's own poll page in an iframe. Heavier
 *     (cross-origin frame + siono's CSS bundle), but isolates the
 *     widget so siono can ship UI changes without coordinating with
 *     embedders. Best for editorial surfaces and third-party blog
 *     embeds. Renders nothing if the underlying poll lookup returns
 *     204.
 *
 *   link — compact CTA card pointing to siono.app. No vote happens
 *     inline; clicking ships the user to siono's full poll page.
 *     Lightest payload (no client island, no iframe). Best for
 *     contexts where attention is short or you want to drive traffic
 *     into siono itself.
 */
export type SionoPollMode = 'inline' | 'iframe' | 'link';

interface ContextProps {
  context: LookupContext;
  pollId?: never;
  /** Header label rendered above the poll question. Defaults to a
   *  generic "Fan poll" tag. */
  eyebrow?: string;
  mode?:    SionoPollMode;
  /** iframe height in px. Only honored when `mode='iframe'`.
   *  Default 360 matches the siono embed page's natural height
   *  for 2–4 options. */
  iframeHeight?: number;
}
interface PinnedProps {
  context?: never;
  pollId:  string;
  eyebrow?: string;
  mode?:    SionoPollMode;
  iframeHeight?: number;
}
type Props = ContextProps | PinnedProps;

export async function SionoPollEmbed(props: Props): Promise<React.ReactElement | null> {
  // Discriminate on pollId so TS narrows context to non-undefined on
  // the else branch. The union types ensure exactly one is set.
  const poll = props.pollId !== undefined
    ? await fetchEmbedPollById(props.pollId)
    : await fetchEmbedPollByContext(props.context as LookupContext);
  if (!poll) return null;

  const eyebrow = props.eyebrow ?? 'Fan poll · powered by Siono';
  const mode    = props.mode ?? 'inline';
  const isResolved = poll.status === 'resolved';
  const isClosed   = poll.status === 'closed' || isResolved;
  const closesIn   = poll.closesAt && !isClosed ? formatCountdown(poll.closesAt) : null;

  // ─── mode='iframe' ──────────────────────────────────────────────
  // Point at siono.app's standalone embed page. The lookup above
  // already confirmed the poll exists, so we know the iframe URL
  // resolves to something. lazy-loaded so the iframe doesn't fight
  // the SSR pass for bandwidth.
  if (mode === 'iframe') {
    const iframeSrc = poll.shareUrl.replace(/\/d\//, '/embed/poll/');
    const height = props.iframeHeight ?? 360;
    return (
      <div className="rounded-2xl border border-ink-700 bg-ink-900/40 overflow-hidden">
        <iframe
          src={iframeSrc}
          title={poll.question}
          loading="lazy"
          referrerPolicy="origin"
          // sandbox: allow scripts (for vote) and same-origin (for
          // localStorage deviceId). No allow-top-navigation = the
          // iframe can't redirect the parent.
          sandbox="allow-scripts allow-same-origin allow-popups"
          style={{ width: '100%', height: `${height}px`, border: '0', display: 'block' }}
        />
      </div>
    );
  }

  // ─── mode='link' ────────────────────────────────────────────────
  // Compact CTA card — no vote inline. Drives traffic into siono.
  if (mode === 'link') {
    return (
      <a
        href={poll.shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl border border-ink-700 hover:border-brand-500/70 bg-ink-900/60 backdrop-blur-sm p-5 transition-colors group"
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-[10px] uppercase tracking-widest text-brand-400 font-semibold">
            {eyebrow}
          </p>
          <p className="text-[10px] text-ink-500 tabular-nums">
            {poll.totals.votes.toLocaleString()} votes
          </p>
        </div>
        <p className="text-lg font-semibold text-white leading-snug">
          {poll.question}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-ink-400">
            {poll.options.length} options
          </span>
          <span className="text-sm text-brand-400 group-hover:text-brand-300 font-semibold">
            Vote on siono.app →
          </span>
        </div>
      </a>
    );
  }

  // ─── mode='inline' (default) ────────────────────────────────────
  return (
    <section
      aria-labelledby={`siono-poll-${poll.pollId}`}
      className="rounded-2xl border border-ink-700 bg-ink-900/60 backdrop-blur-sm p-5 shadow-lg shadow-black/20"
    >
      <header className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[10px] uppercase tracking-widest text-brand-400 font-semibold">
          {eyebrow}
        </p>
        <p className="text-[10px] text-ink-500 tabular-nums">
          {isResolved ? 'Final result' :
           isClosed ? 'Closed' :
           closesIn ? `Closes ${closesIn}` :
           `${poll.totals.votes.toLocaleString()} votes`}
        </p>
      </header>

      <h3
        id={`siono-poll-${poll.pollId}`}
        className="text-lg sm:text-xl font-semibold text-white mb-4 leading-snug"
      >
        {poll.question}
      </h3>

      {/* Options live in the client island so the vote interaction
          can hydrate without re-fetching. The SSR pass renders the
          buttons as plain HTML (still indexable / accessible) and
          the island swaps in handlers + state on hydrate. */}
      <SionoPollVote poll={poll} />

      <footer className="mt-3 flex items-center justify-between text-[11px] text-ink-500">
        <a
          href={poll.shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-brand-400 transition-colors"
        >
          Share or comment on siono.app →
        </a>
        {poll.resolved?.note && (
          <span className="text-emerald-400/80">{poll.resolved.note}</span>
        )}
      </footer>
    </section>
  );
}

/** Render "in 2h 14m" / "in 3d" — short relative time until the
 *  poll closes. Refreshed every 30s by the Next data cache so we
 *  don't need a client-side timer. */
function formatCountdown(iso: string): string | null {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const m = Math.round(ms / 60000);
  if (m < 60)        return `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24)        return `in ${h}h`;
  const d = Math.round(h / 24);
  return `in ${d}d`;
}
