'use client';

/**
 * Hydration island for SionoPollEmbed.
 *
 * Wraps the SSR-rendered question + options with vote interaction.
 * The server component renders the question and a `<ul>` of options
 * as static HTML (great for crawlers, accessible by default); this
 * client component layers on:
 *
 *   - localStorage-backed deviceId so repeat voters from the same
 *     browser are deduped server-side
 *   - vote handler that POSTs to siono.app and animates the resulting
 *     percentage bars in
 *   - inline error / rate-limit handling without a blocking modal
 *
 * The component takes the entire initial wire payload as a prop so
 * the SSR pass and the hydrated client see exactly the same totals —
 * no FOUC, no double-fetch.
 *
 * The deviceId is intentionally NOT a privacy-significant identifier.
 * It's a random uuid stored in localStorage, scoped to siono.app's
 * dedup-on-vote logic. Clearing site data resets it. No tracking
 * across surfaces is done with it.
 */

import { useEffect, useMemo, useState } from 'react';
import type { EmbedPollWire } from '@/lib/siono-embed';

interface Props {
  poll: EmbedPollWire;
}

const DEVICE_ID_KEY = 'siono.embed.deviceId';

function ensureDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let v = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!v) {
    v = crypto.randomUUID();
    try { window.localStorage.setItem(DEVICE_ID_KEY, v); } catch { /* private mode */ }
  }
  return v;
}

function lastVoteKey(pollId: string) { return `siono.embed.vote.${pollId}`; }

export function SionoPollVote({ poll }: Props) {
  // We optimistically reflect the user's vote client-side so the bars
  // feel instant; the totals on screen come from the latest server
  // response (initial wire payload, then the POST response).
  const [totals, setTotals]   = useState(poll.totals);
  const [voted, setVoted]     = useState<string | null>(null);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const isClosed = poll.status === 'closed' || poll.status === 'resolved';

  // Restore the prior vote (if any) from localStorage on hydrate so
  // the bars render in "you voted X" state without a server round-
  // trip. Vote dedup itself is enforced server-side by deviceId — this
  // is purely a UX hint.
  useEffect(() => {
    try {
      const prior = window.localStorage.getItem(lastVoteKey(poll.pollId));
      if (prior && poll.options.some((o) => o.id === prior)) setVoted(prior);
    } catch { /* localStorage unavailable */ }
  }, [poll.pollId, poll.options]);

  // Percentages — recomputed whenever totals change. Empty poll
  // shows 0% across the board.
  const pct = useMemo(() => {
    const total = Math.max(totals.votes, 1);
    return Object.fromEntries(
      poll.options.map((o) => [o.id, Math.round(((totals.byOption[o.id] ?? 0) / total) * 100)]),
    );
  }, [totals, poll.options]);

  async function castVote(optionId: string) {
    if (busy || isClosed) return;
    setBusy(true);
    setError(null);
    // Optimistic: mark as voted so the UI updates before the round-trip.
    const optimisticPrev = voted;
    setVoted(optionId);
    try {
      const res = await fetch(poll.voteUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          optionId,
          deviceId: ensureDeviceId(),
          referrer: typeof window !== 'undefined' ? window.location.href : undefined,
          origin:   'wc-explorer',
        }),
      });
      if (res.status === 429) {
        setVoted(optimisticPrev);
        setError('You\'re voting too fast — try again in a minute.');
        return;
      }
      if (res.status === 410) {
        setError('This poll just closed.');
        return;
      }
      if (!res.ok) {
        setVoted(optimisticPrev);
        setError('Couldn\'t submit — try again.');
        return;
      }
      const json = await res.json() as { ok: boolean; totals: typeof totals; yourVote: string };
      setTotals(json.totals);
      setVoted(json.yourVote);
      try { window.localStorage.setItem(lastVoteKey(poll.pollId), json.yourVote); } catch { /* ignore */ }
    } catch {
      setVoted(optimisticPrev);
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ul className="space-y-2" role="radiogroup" aria-label={poll.question}>
      {poll.options.map((opt) => {
        const isMine     = voted === opt.id;
        const percentage = pct[opt.id] ?? 0;
        const count      = totals.byOption[opt.id] ?? 0;
        const isResolved = poll.resolved?.optionId === opt.id;
        return (
          <li key={opt.id}>
            <button
              type="button"
              role="radio"
              aria-checked={isMine}
              disabled={busy || isClosed}
              onClick={() => castVote(opt.id)}
              className={`group relative w-full text-left rounded-lg border px-3 py-2 transition-colors overflow-hidden ${
                isMine
                  ? 'border-brand-500 bg-brand-500/15'
                  : 'border-ink-700 hover:border-ink-600 hover:bg-ink-800/40'
              } ${isClosed ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {/* Vote-share bar — animated width from 0 → pct. Sits
                  behind the option text so it reads as a fill, not
                  a separate element. */}
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 transition-[width] duration-500 ease-out ${
                  isMine ? 'bg-brand-500/25' :
                  isResolved ? 'bg-emerald-500/20' :
                  'bg-ink-700/50'
                }`}
                style={{ width: `${(voted || isClosed) ? percentage : 0}%` }}
              />
              <span className="relative flex items-baseline justify-between gap-2">
                <span className="text-ink-100 font-medium">
                  {opt.text}
                  {isResolved && (
                    <span className="ml-2 text-xs font-normal text-emerald-400">✓ outcome</span>
                  )}
                </span>
                {(voted || isClosed) && (
                  <span className="text-xs tabular-nums text-ink-400">
                    {percentage}% <span className="text-ink-600">· {count.toLocaleString()}</span>
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
      {error && (
        <li className="text-xs text-amber-400" role="alert">{error}</li>
      )}
    </ul>
  );
}
