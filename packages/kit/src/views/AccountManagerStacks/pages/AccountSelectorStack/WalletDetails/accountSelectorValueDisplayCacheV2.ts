import { isEqual, isPlainObject } from 'lodash';

import type { SelectorTextSegment } from '@onekeyfe/react-native-native-list';

// Balance segments the account rows last displayed, one SWR entry per wallet.
// Only UI text is kept (not the raw value/DeFi data), so a wallet revisit or a
// cold start paints the previous balances on the first frame for a few KB.
export type IAccountSelectorValueDisplayScopeV2 = {
  // Target currency the texts were formatted in.
  currency: string;
  rows: Record<string, SelectorTextSegment>;
  // Last write, for evicting the least recently shown scope.
  t: number;
};

export type IAccountSelectorValueDisplayCacheV2 = {
  scopes: Record<string, IAccountSelectorValueDisplayScopeV2>;
};

// The first rows cover the initial screens; later rows still load on scroll.
export const ACCOUNT_SELECTOR_VALUE_DISPLAY_MAX_ROWS = 100;
// Network/derive contexts kept per wallet.
export const ACCOUNT_SELECTOR_VALUE_DISPLAY_MAX_SCOPES = 4;

export function buildAccountSelectorValueDisplayScopeKeyV2({
  deriveType,
  linkedNetworkId,
  selectedNetworkId,
  keepAllOtherAccounts,
}: {
  deriveType: string;
  linkedNetworkId?: string;
  selectedNetworkId?: string;
  keepAllOtherAccounts?: boolean;
}) {
  return [
    deriveType,
    linkedNetworkId ?? '',
    selectedNetworkId ?? '',
    keepAllOtherAccounts ? '1' : '0',
  ].join('|');
}

function isSegment(value: unknown): value is SelectorTextSegment {
  return (
    isPlainObject(value) &&
    typeof (value as { text?: unknown }).text === 'string'
  );
}

// Well-formed scopes of a persisted entry; anything else is ignored.
function readScopes(
  cache: unknown,
): Record<string, IAccountSelectorValueDisplayScopeV2> {
  const scopes: Record<string, IAccountSelectorValueDisplayScopeV2> = {};
  const raw = isPlainObject(cache)
    ? (cache as { scopes?: unknown }).scopes
    : undefined;
  if (!isPlainObject(raw)) return scopes;
  Object.entries(raw as Record<string, unknown>).forEach(([key, scope]) => {
    if (
      isPlainObject(scope) &&
      typeof (scope as { currency?: unknown }).currency === 'string' &&
      isPlainObject((scope as { rows?: unknown }).rows)
    ) {
      scopes[key] = scope as IAccountSelectorValueDisplayScopeV2;
    }
  });
  return scopes;
}

// Segments to show before live values arrive. Texts formatted in another
// currency are not reused; hidden balances never reveal cached texts.
export function readAccountSelectorValueDisplayRowsV2({
  cache,
  scopeKey,
  currency,
  hideValue,
}: {
  cache: unknown;
  scopeKey: string;
  currency: string;
  hideValue: boolean;
}): Record<string, SelectorTextSegment> | undefined {
  const scope = readScopes(cache)[scopeKey];
  if (!scope || scope.currency !== currency) return undefined;
  const rows: Record<string, SelectorTextSegment> = {};
  Object.entries(scope.rows).forEach(([accountId, segment]) => {
    if (!isSegment(segment)) return;
    rows[accountId] = hideValue
      ? {
          text: '****',
          tone: segment.tone === 'disabled' ? 'disabled' : 'secondary',
        }
      : segment;
  });
  return rows;
}

// The next cache entry, or undefined when the displayed rows are already
// stored. Accounts without a live segment keep their previous text.
export function mergeAccountSelectorValueDisplayRowsV2({
  cache,
  scopeKey,
  currency,
  accountIds,
  liveRows,
  now,
}: {
  cache: unknown;
  scopeKey: string;
  currency: string;
  accountIds: readonly string[];
  liveRows: Record<string, SelectorTextSegment>;
  now: number;
}): IAccountSelectorValueDisplayCacheV2 | undefined {
  const scopes = readScopes(cache);
  const previous = scopes[scopeKey];
  const previousRows =
    previous?.currency === currency ? previous.rows : undefined;
  const rows: Record<string, SelectorTextSegment> = {};
  accountIds
    .slice(0, ACCOUNT_SELECTOR_VALUE_DISPLAY_MAX_ROWS)
    .forEach((accountId) => {
      const segment = liveRows[accountId] ?? previousRows?.[accountId];
      if (segment && isSegment(segment)) rows[accountId] = segment;
    });
  if (!Object.keys(rows).length) return undefined;
  if (previous?.currency === currency && isEqual(previous.rows, rows)) {
    return undefined;
  }
  const nextScopes: Record<string, IAccountSelectorValueDisplayScopeV2> =
    Object.fromEntries(
      Object.entries(scopes)
        .filter(([key]) => key !== scopeKey)
        .toSorted(([, left], [, right]) => (right.t ?? 0) - (left.t ?? 0))
        .slice(0, ACCOUNT_SELECTOR_VALUE_DISPLAY_MAX_SCOPES - 1),
    );
  nextScopes[scopeKey] = { currency, rows, t: now };
  return { scopes: nextScopes };
}
