import type { IEarnPopupActionIcon } from '@onekeyhq/shared/types/staking';

type IPopupItem = NonNullable<IEarnPopupActionIcon['data']['items']>[number];

export type IYieldSegment = {
  color: string;
  weight: number;
};

// The performance fee is subtracted from the yield rather than being part of
// it, so it never gets a bar segment.
const BAR_KINDS = new Set(['base', 'reward', 'campaign']);

export function isYieldSheetAvailable(
  data: IEarnPopupActionIcon['data'] | undefined,
): boolean {
  if (!data?.yieldSummary || !data.items?.length) {
    return false;
  }
  // The server fills kind/rate for every row or none at all — a partially
  // filled breakdown would draw a bar with wrong proportions.
  return data.items.every((item) => item.kind && item.rate !== undefined);
}

export function buildYieldSegments(
  items: IPopupItem[] | undefined,
): IYieldSegment[] {
  if (!items?.length) {
    return [];
  }
  return items.reduce<IYieldSegment[]>((segments, item) => {
    if (!item.kind || !BAR_KINDS.has(item.kind)) {
      return segments;
    }
    const parsed = Number.parseFloat(item.rate ?? '');
    // A zero or negative row would either add nothing or invert the bar.
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return segments;
    }
    segments.push({ color: item.color || '$bgSubdued', weight: parsed });
    return segments;
  }, []);
}

export type IHeadlineApyParts = {
  /** the vault's own yield, rendered green */
  base: string;
  /** campaign boost + protocol rewards, summed */
  bonus?: string;
  /** color of the bonus half — taken from the breakdown row itself, so the
   * headline always matches the Yield sheet's bar */
  bonusColor?: string;
};

const BONUS_KINDS = new Set(['reward', 'campaign']);

/**
 * Splits the headline APY into the two halves the design draws: a green base
 * figure followed by an orange bonus figure, e.g. `5.10%` `+2.12%`.
 *
 * Built from the same kind/rate fields the Yield sheet's bar uses, so the two
 * can never disagree. Returns undefined when the breakdown is unavailable and
 * the caller should fall back to the single string the server rendered.
 */
export function buildHeadlineApyParts(
  items: IPopupItem[] | undefined,
): IHeadlineApyParts | undefined {
  if (!items?.length) {
    return undefined;
  }
  let base: number | undefined;
  let bonus = 0;
  let bonusColor: string | undefined;
  items.forEach((item) => {
    const parsed = Number.parseFloat(item.rate ?? '');
    if (!item.kind || !Number.isFinite(parsed)) {
      return;
    }
    if (item.kind === 'base') {
      base = (base ?? 0) + parsed;
      return;
    }
    if (BONUS_KINDS.has(item.kind) && parsed > 0) {
      bonus += parsed;
      // A campaign wins the color; a page carrying only protocol rewards keeps
      // theirs. Same precedence the chart's second line uses.
      if (!bonusColor || item.kind === 'campaign') {
        bonusColor = item.color;
      }
    }
  });
  if (base === undefined) {
    return undefined;
  }
  return {
    base: `${base.toFixed(2)}%`,
    ...(bonus > 0
      ? {
          bonus: `+${bonus.toFixed(2)}%`,
          bonusColor: bonusColor || '$textCaution',
        }
      : {}),
  };
}

export function formatCountdown(
  remainingMs: number,
): { days: number; hours: number; minutes: number; seconds: number } | null {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return null;
  }
  const totalSeconds = Math.floor(remainingMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}
