import BigNumber from 'bignumber.js';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';

import { ITEM_VALUE_PROPS } from './constants';

const STAT_FALLBACK_VALUE = '--';

function normalizeOptionalStatValue(value?: string | number | null) {
  if (value === null || typeof value === 'undefined') {
    return undefined;
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : `${value}`;
  return normalizedValue || undefined;
}

export function renderCurrencyValue(
  value?: string | number,
  options?: { forceMarketCapFormatter?: boolean },
) {
  const normalizedValue = value || '0';
  const isAboveThreshold = new BigNumber(normalizedValue).gte(10);
  return (
    <NumberSizeableText
      size={ITEM_VALUE_PROPS.size}
      formatter={
        options?.forceMarketCapFormatter || isAboveThreshold
          ? 'marketCap'
          : 'value'
      }
      formatterOptions={{ currency: '$' }}
    >
      {normalizedValue}
    </NumberSizeableText>
  );
}

export function renderAmountValue(value?: string | number) {
  const normalizedValue = value || '0';
  const isAboveThreshold = new BigNumber(normalizedValue).gte(10);
  return (
    <NumberSizeableText
      size={ITEM_VALUE_PROPS.size}
      formatter={isAboveThreshold ? 'marketCap' : 'value'}
    >
      {normalizedValue}
    </NumberSizeableText>
  );
}

export function renderRatioValue(value?: string | number | null) {
  const normalizedValue = normalizeOptionalStatValue(value);
  if (!normalizedValue) {
    return (
      <SizableText size={ITEM_VALUE_PROPS.size}>
        {STAT_FALLBACK_VALUE}
      </SizableText>
    );
  }

  return (
    <NumberSizeableText size={ITEM_VALUE_PROPS.size} formatter="value">
      {normalizedValue}
    </NumberSizeableText>
  );
}

export function renderPercentValue(value?: string | number | null) {
  const normalizedValue = normalizeOptionalStatValue(value);
  if (!normalizedValue) {
    return (
      <SizableText size={ITEM_VALUE_PROPS.size}>
        {STAT_FALLBACK_VALUE}
      </SizableText>
    );
  }

  return (
    <XStack alignItems="center">
      <NumberSizeableText size={ITEM_VALUE_PROPS.size} formatter="marketCap">
        {normalizedValue}
      </NumberSizeableText>
      <SizableText size={ITEM_VALUE_PROPS.size}>%</SizableText>
    </XStack>
  );
}

export function renderHoldersValue({
  holders,
  isNative,
}: {
  holders?: number;
  isNative?: boolean;
}) {
  const holderValue = holders?.toString() || '0';
  const isAboveThreshold = new BigNumber(holderValue).gte(10);
  return (
    <NumberSizeableText
      size={ITEM_VALUE_PROPS.size}
      formatter={isAboveThreshold ? 'marketCap' : 'value'}
    >
      {isNative ? '-' : holderValue}
    </NumberSizeableText>
  );
}
