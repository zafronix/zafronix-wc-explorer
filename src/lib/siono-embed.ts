/**
 * Siono embed-poll client (read side).
 *
 * Talks to siono.app's `/api/embed/polls/...` surface to fetch the
 * right poll for a given page context, or one pinned by id. Used by
 * the `<SionoPollEmbed>` server component.
 *
 * Caching:
 *   - Next data cache is set to `revalidate: 30` to match siono's
 *     `s-maxage=30, stale-while-revalidate=300` header on the lookup
 *     endpoint. We accept up-to-30-second stale totals on the embed.
 *   - Tagged by `siono-poll:{pollId}` once we know the id, so a future
 *     webhook from siono can `revalidateTag()` after a resolve event.
 *
 * Errors are swallowed and return null — embeds must never block page
 * render. The fallback render is to draw nothing (the component
 * returns null), so a siono outage degrades to "no poll on this page"
 * which is exactly the same as a 204 No Content.
 */

import 'server-only';

const SIONO_BASE = process.env.SIONO_EMBED_BASE ?? 'https://siono.app';

export interface EmbedPollWire {
  pollId:    string;
  question:  string;
  type:      'poll';
  options:   { id: string; text: string }[];
  totals:    { votes: number; byOption: Record<string, number> };
  status:    'draft' | 'active' | 'closed' | 'resolved';
  opensAt?:  string;
  closesAt?: string;
  resolved?: {
    optionId: string;
    at:       string;
    note?:    string;
  };
  context: {
    pageType?:   string;
    matchId?:    string;
    teamId?:     string;
    groupId?:    string;
    hostCityId?: string;
    tournament?: string;
  };
  voteUrl:   string;
  shareUrl:  string;
  priority?: number;
}

export interface LookupContext {
  matchId?:    string;
  teamId?:     string;
  groupId?:    string;
  hostCityId?: string;
  tournament?: string;
}

/** Fetch the best-matching active poll for a context. Returns null when
 *  siono returns 204 (no poll) or on any error (siono outage etc.). */
export async function fetchEmbedPollByContext(ctx: LookupContext): Promise<EmbedPollWire | null> {
  const q = new URLSearchParams();
  if (ctx.matchId)    q.set('matchId',    ctx.matchId);
  if (ctx.teamId)     q.set('teamId',     ctx.teamId);
  if (ctx.groupId)    q.set('groupId',    ctx.groupId);
  if (ctx.hostCityId) q.set('hostCityId', ctx.hostCityId);
  if (ctx.tournament) q.set('tournament', ctx.tournament);
  // Caller must supply at least one resolution key — siono returns
  // 400 if none are present and we'd just be wasting a round trip.
  if (q.toString().length === 0) return null;
  q.set('origin', 'wc-explorer');

  try {
    const res = await fetch(`${SIONO_BASE}/api/embed/polls/lookup?${q.toString()}`, {
      next: { revalidate: 30 },
      headers: { Accept: 'application/json' },
    });
    if (res.status === 204) return null;
    if (!res.ok) return null;
    return (await res.json()) as EmbedPollWire;
  } catch {
    return null;
  }
}

/** Fetch a specific poll by id. Used when the page pins a poll
 *  override instead of resolving by context. */
export async function fetchEmbedPollById(id: string): Promise<EmbedPollWire | null> {
  try {
    const res = await fetch(`${SIONO_BASE}/api/embed/polls/${encodeURIComponent(id)}`, {
      next: { revalidate: 30, tags: [`siono-poll:${id}`] },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as EmbedPollWire;
  } catch {
    return null;
  }
}
