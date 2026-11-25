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
 * A token row's 24h change. A change that displays as zero ("0.00%") reads as
 * no change: no sign and a neutral tone, whatever its sign before rounding.
 */
export function formatNativeSelectorPriceChange(value: number): {
  text: string;
  segments?: readonly ValueTextSegment[];
  tone: 'secondary' | 'positive' | 'negative';
} {
  const signed = formatNativeSelectorAmount(
    String(value),
    'priceChange',
    undefined,
    true,
  );
  if (/[1-9]/.test(signed.text)) {
    return { ...signed, tone: value > 0 ? 'positive' : 'negative' };
  }
  return {
    ...formatNativeSelectorAmount('0', 'priceChange'),
    tone: 'secondary',
  };
}
