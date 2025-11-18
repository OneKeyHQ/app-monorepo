import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

export const STAT_FALLBACK_VALUE = '--';
type ITTextColorToken =
  | '$textSuccess'
  | '$textCritical'
  | '$textSubdued'
  | '$text';

export function normalizeStatValue(
  value?: string | number | null,
): string | undefined {
  if (value === null || typeof value === 'undefined') {
    return undefined;
  }

  const stringifiedValue = typeof value === 'string' ? value : String(value);
  const normalized = stringifiedValue.trim();

  if (!normalized) {
    return undefined;
  }

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue) || numericValue === 0) {
    return undefined;
  }

  return normalized;
}

export function formatStatValueWithFormatter(
  value?: string | number | null,
  formatterProps?: INumberFormatProps,
) {
  const normalized = normalizeStatValue(value);

  if (!normalized || !formatterProps) {
    return STAT_FALLBACK_VALUE;
  }

  return numberFormat(normalized, formatterProps);
}

export function formatPriceChangeDisplay(value?: string | number | null): {
  color: ITTextColorToken;
  display: string;
} {
  if (value === null || typeof value === 'undefined') {
    return {
      color: '$textSubdued',
      display: STAT_FALLBACK_VALUE,
    };
  }
  const stringValue =
    typeof value === 'string' ? value.trim() : String(value).trim();
  if (!stringValue) {
    return {
      color: '$textSubdued',
      display: STAT_FALLBACK_VALUE,
    };
  }

  const numericValue = Number(stringValue);
  if (!Number.isFinite(numericValue)) {
    return {
      color: '$textSubdued',
      display: STAT_FALLBACK_VALUE,
    };
  }

  if (numericValue === 0) {
    return {
      color: '$text',
      display: '0%',
    };
  }

  const isPriceUp = numericValue > 0;
  const prefix = isPriceUp ? '+' : '';
  const truncated = stringValue.slice(0, 6);

  return {
    color: isPriceUp ? '$textSuccess' : '$textCritical',
    display: `${prefix}${truncated}%`,
  };
}
