import { numberFormatAsRenderText } from '@onekeyhq/shared/src/utils/numberUtils';

import type { ValueTextSegment } from '@onekeyfe/react-native-native-list';

export function formatNativeSelectorAmount(
  value: string,
  formatter: 'balance' | 'value' | 'price' | 'priceChange',
  currency?: string,
  showPlusMinusSigns?: boolean,
): { text: string; segments?: readonly ValueTextSegment[] } {
  if (['--', ' -- ', ' - ', '-'].includes(value)) return { text: value };
  const result = numberFormatAsRenderText(value, {
    formatter,
    formatterOptions: { currency, showPlusMinusSigns },
  });
  if (typeof result === 'string') return { text: result };
  const segments = result.map<ValueTextSegment>((part) =>
    typeof part === 'string'
      ? { text: part }
      : {
          text: String(part.value),
          ...(part.type === 'sub' ? { style: 'subscript' as const } : {}),
        },
  );
  return { text: segments.map((part) => part.text).join(''), segments };
}

/**
 * A formatted number as plain text, for screen readers: a tiny value's
 * subscript zero count is spelled out again ("0.0₅147" reads "0.00000147"),
 * where joining the segments would read "0.05147".
 */
export function plainNativeSelectorText(amount: {
  text: string;
  segments?: readonly ValueTextSegment[];
}): string {
  if (!amount.segments?.some((segment) => segment.style === 'subscript')) {
    return amount.text;
  }
  return amount.segments
    .map((segment) =>
      segment.style === 'subscript'
        ? '0'.repeat(Math.max(0, Number(segment.text) - 1))
        : segment.text,
    )
    .join('');
}
