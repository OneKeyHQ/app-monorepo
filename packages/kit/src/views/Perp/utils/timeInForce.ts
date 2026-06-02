import type { ITIF } from '@onekeyhq/shared/types/hyperliquid/sdk';

export const TIF_OPTIONS: ReadonlyArray<{
  label: string;
  value: ITIF;
}> = [
  {
    label: 'GTC',
    value: 'Gtc',
  },
  {
    label: 'IOC',
    value: 'Ioc',
  },
  {
    label: 'ALO',
    value: 'Alo',
  },
];

export function isTifValue(value: string | undefined): value is ITIF {
  return value === 'Gtc' || value === 'Ioc' || value === 'Alo';
}

export function getTifLabel(
  value: ITIF | null | undefined,
): string | undefined {
  return TIF_OPTIONS.find((option) => option.value === value)?.label;
}
