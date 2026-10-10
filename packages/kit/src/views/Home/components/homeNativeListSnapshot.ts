import { validateSnapshot } from '@onekeyfe/react-native-native-list';

import type {
  NativeListSnapshot,
  RowModel,
  ValueTextSegment,
} from '@onekeyfe/react-native-native-list';

const MAX_NATIVE_LIST_TEXT_LENGTH = 4096;

function truncateText(text: string): string {
  if (typeof text !== 'string' || text.length <= MAX_NATIVE_LIST_TEXT_LENGTH)
    return text;
  let end = MAX_NATIVE_LIST_TEXT_LENGTH;
  // NativeList counts UTF-16 code units; avoid cutting a surrogate pair.
  if (/^[\uD800-\uDBFF]$/.test(text[end - 1])) end -= 1;
  return text.slice(0, end);
}

function truncateSegments(segments?: readonly ValueTextSegment[]) {
  return segments?.map((segment) => ({
    ...segment,
    text: truncateText(segment.text),
  }));
}

function normalizeRowText(row: RowModel): RowModel {
  if (row.type === 'activity') {
    return {
      ...row,
      title: truncateText(row.title),
      description: row.description && truncateText(row.description),
      amounts: row.amounts?.map((amount) => ({
        ...amount,
        text: truncateText(amount.text),
        secondaryText:
          amount.secondaryText && truncateText(amount.secondaryText),
        textSegments: truncateSegments(amount.textSegments),
        secondaryTextSegments: truncateSegments(amount.secondaryTextSegments),
      })),
      badges: row.badges?.map((badge) => ({
        ...badge,
        text: truncateText(badge.text),
      })),
      fee: row.fee && {
        ...row.fee,
        label: row.fee.label && truncateText(row.fee.label),
        primary: truncateText(row.fee.primary),
        secondary: row.fee.secondary && truncateText(row.fee.secondary),
        primaryTextSegments: truncateSegments(row.fee.primaryTextSegments),
        secondaryTextSegments: truncateSegments(row.fee.secondaryTextSegments),
      },
    };
  }
  if (row.type === 'mediaTile') {
    return {
      ...row,
      title: truncateText(row.title),
      subtitle: row.subtitle && truncateText(row.subtitle),
      badge: row.badge && {
        ...row.badge,
        text: truncateText(row.badge.text),
      },
    };
  }
  return row;
}

export function historySectionKey(firstTransactionId: string): string {
  // Frozen order can split one date into separate groups; the first row keeps
  // each header stable and unique even when its displayed date changes.
  return `section:${firstTransactionId}`;
}

export function prepareHomeNativeListSnapshot(
  snapshot: NativeListSnapshot,
): NativeListSnapshot {
  // Normalize untrusted display text before NativeList serializes the snapshot.
  const normalized = {
    ...snapshot,
    rows: snapshot.rows.map((row) => {
      try {
        return normalizeRowText(row);
      } catch {
        // Leave malformed runtime values for the row validator to reject.
        return row;
      }
    }),
  };
  try {
    validateSnapshot(normalized);
    return normalized;
  } catch {
    const seenKeys = new Set<string>();
    // A row that fails NativeList's own contract must not hide its valid peers.
    const rows = normalized.rows.filter((row) => {
      if (seenKeys.has(row.key)) return false;
      try {
        validateSnapshot({ ...normalized, rows: [row] });
        seenKeys.add(row.key);
        return true;
      } catch {
        return false;
      }
    });
    return { ...normalized, rows };
  }
}
