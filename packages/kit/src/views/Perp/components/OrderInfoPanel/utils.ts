import BigNumber from 'bignumber.js';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  formatSpotPairDisplayName,
  getSpotTokenDisplayName,
  isSpotInstrument,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import type { IColumnConfig } from './List/CommonTableListView';
import type { IntlShape } from 'react-intl';

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

export const getOrderAssetDisplayName = (
  coin: string,
  spotDisplayMap: Record<string, string>,
  spotPairDisplayNameMap: Record<string, string> = {},
) => {
  if (!isSpotInstrument(coin)) {
    return parseDexCoin(coin).displayName;
  }

  if (coin.includes('/')) {
    const [baseName, quoteName] = coin.split('/');
    return formatSpotPairDisplayName(baseName, quoteName);
  }

  return (
    spotPairDisplayNameMap[coin] ??
    spotDisplayMap[coin] ??
    getSpotTokenDisplayName(coin)
  );
};

export const getOrderSizeDisplayName = (
  coin: string,
  spotDisplayMap: Record<string, string>,
) => {
  if (!isSpotInstrument(coin)) {
    return parseDexCoin(coin).displayName;
  }

  if (coin.includes('/')) {
    const [baseName] = coin.split('/');
    return getSpotTokenDisplayName(baseName);
  }

  const displayName = spotDisplayMap[coin] ?? getSpotTokenDisplayName(coin);
  const [baseName] = displayName.split('/');
  return baseName;
};

export function normalizeEpochMs(timestamp: number | undefined) {
  if (!timestamp) {
    return undefined;
  }
  return timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
}

export function getTwapHistoryEventTimeMs(record: {
  time?: number;
  state: { timestamp: number };
}) {
  // Hyperliquid TWAP History displays the history record time, not the
  // TWAP state's start timestamp.
  return normalizeEpochMs(record.time) ?? record.state.timestamp;
}

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

export const getFillDirectionDisplayInfo = ({
  fill,
  intl,
}: {
  fill: { coin: string; dir?: string; side: string };
  intl: IntlShape;
}) => {
  if (isSpotInstrument(fill.coin)) {
    return {
      text: intl.formatMessage({
        id:
          fill.side === 'B'
            ? ETranslations.global_buy
            : ETranslations.global_sell,
      }),
      color: fill.side === 'B' ? '$green11' : '$red11',
    };
  }

  let color = fill.side === 'B' ? '$green11' : '$red11';
  const directionType = getPerpFillDirectionType(fill.dir);
  let text = fill.dir ?? '';

  if (directionType === 'openLong') {
    text = intl.formatMessage({ id: ETranslations.perp_long });
  } else if (directionType === 'openShort') {
    text = intl.formatMessage({ id: ETranslations.perp_short });
  } else if (directionType === 'closeLong') {
    text = intl.formatMessage({ id: ETranslations.perp_order_close_long });
  } else if (directionType === 'closeShort') {
    text = intl.formatMessage({ id: ETranslations.perp_order_close_short });
  }

  if (fill.side === 'A') {
    color = '$red11';
  }

  return { text, color };
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
