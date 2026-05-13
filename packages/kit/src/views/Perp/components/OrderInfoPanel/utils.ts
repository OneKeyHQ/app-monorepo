import BigNumber from 'bignumber.js';

import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import type { IColumnConfig } from './List/CommonTableListView';

const spotHoldingPnlCurrencyFormatter: INumberFormatProps = {
  formatter: 'value',
  formatterOptions: {
    currency: '$',
  },
};

const SPOT_HOLDING_STABLE_COINS = new Set(['USDC', 'USDT', 'USDB', 'USDH']);

export type IPerpFillDirectionType =
  | 'openLong'
  | 'openShort'
  | 'closeLong'
  | 'closeShort'
  | 'unknown';

export const calcCellAlign = (align?: string) => {
  if (align === 'left') {
    return 'flex-start';
  }
  if (align === 'right') {
    return 'flex-end';
  }
  return 'center';
};

export const getColumnStyle = (column: IColumnConfig) => {
  const isFixedWidth = !!column.width;
  return {
    width: isFixedWidth ? column.width : undefined,
    minWidth: isFixedWidth ? undefined : column.minWidth,
    flexGrow: isFixedWidth ? undefined : column.flex || 1,
    flexBasis: isFixedWidth ? undefined : 0,
  };
};

export const getPerpFillDirectionType = (
  direction?: string,
): IPerpFillDirectionType => {
  const normalizedDirection = direction?.trim().toLowerCase() ?? '';

  if (normalizedDirection.includes('close long')) {
    return 'closeLong';
  }

  if (normalizedDirection.includes('close short')) {
    return 'closeShort';
  }

  if (normalizedDirection.includes('long')) {
    return 'openLong';
  }

  if (normalizedDirection.includes('short')) {
    return 'openShort';
  }

  return 'unknown';
};

export const isSpotHoldingStableCoin = (coin: string) =>
  SPOT_HOLDING_STABLE_COINS.has(coin.toUpperCase());

export const calculateSpotHoldingPnl = ({
  total,
  entryNtl,
  midPrice,
  isStable,
}: {
  total: string;
  entryNtl?: string;
  midPrice?: string;
  isStable: boolean;
}): {
  pnl?: string;
  pnlPercent?: number;
} => {
  const totalBN = new BigNumber(total);
  const entryNtlBN = new BigNumber(entryNtl || '0');
  const midPriceBN = new BigNumber(midPrice || '0');

  if (
    isStable ||
    !midPrice ||
    entryNtlBN.isZero() ||
    !totalBN.isFinite() ||
    !entryNtlBN.isFinite() ||
    !midPriceBN.isFinite()
  ) {
    return {};
  }

  const pnlBN = totalBN.multipliedBy(midPriceBN).minus(entryNtlBN);
  return {
    pnl: pnlBN.toFixed(),
    pnlPercent: pnlBN.dividedBy(entryNtlBN).multipliedBy(100).toNumber(),
  };
};

export function formatSpotHoldingPnlText(
  pnl?: string,
  pnlPercent?: number,
): string {
  if (!pnl) return '--';

  const pnlBN = new BigNumber(pnl);
  if (!pnlBN.isFinite() || pnlBN.isZero()) return '--';

  const sign = pnlBN.gt(0) ? '+' : '-';
  const formattedPnl = numberFormat(pnlBN.abs().toFixed(2), {
    ...spotHoldingPnlCurrencyFormatter,
  });
  const formattedPnlPercent = new BigNumber(pnlPercent ?? 0).abs().toFixed(1);

  return `${sign}${formattedPnl} (${sign}${formattedPnlPercent}%)`;
}
