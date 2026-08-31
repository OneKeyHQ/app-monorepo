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
