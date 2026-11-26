import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  numberFormat,
  numberFormatAsRenderText,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

import type {
  DataColumn,
  DataRow,
  NativeListTableColumn,
} from '@onekeyfe/react-native-native-list';

export function holderLayout(width: number) {
  const contentWidth = width - 32;
  // Keep the existing rank and address minima and one value-width per metric.
  const wide = contentWidth >= 40 + 200 + 3 * 80;
  const rankWidth = wide ? Math.max(40, Math.floor(contentWidth * 0.05)) : 28;
  const addressWidth = wide
    ? Math.max(200, Math.floor(contentWidth * 0.2))
    : undefined;
  const metricWidth = Math.floor(
    (contentWidth - rankWidth - (addressWidth ?? 0)) / 3,
  );
  return {
    wide,
    rankWidth,
    addressWidth,
    percentageWidth: wide ? metricWidth : 56,
    amountWidth: wide ? metricWidth : undefined,
    valueWidth: wide
      ? contentWidth - rankWidth - (addressWidth ?? 0) - 2 * metricWidth
      : 80,
    gap: wide ? 0 : 12,
    padding: wide ? 12 : 20,
  };
}

function formattedAmount(value: string, currency?: string) {
  const options = {
    formatter: 'marketCap',
    formatterOptions: { currency },
  } as const;
  const formatted = numberFormatAsRenderText(value, options);
  if (typeof formatted === 'string') return { text: formatted || '-' };
  return {
    text: numberFormat(value, options),
    textSegments: formatted.map((segment) =>
      typeof segment === 'string'
        ? { text: segment }
        : {
            text: String(segment.value),
            ...(segment.type === 'sub' && { style: 'subscript' as const }),
          },
    ),
  };
}

function holderPercentage(value?: string) {
  if (!value) return '-';
  return value === '0.00' ? '<0.01%' : `${value}%`;
}

export function holderRowKey(networkId: string, address: string) {
  return `${networkId}:${address}`;
}

export function buildHolderRow(
  holder: IMarketTokenHolder,
  index: number,
  networkId: string,
  layout: ReturnType<typeof holderLayout>,
  actions: NonNullable<NativeListTableColumn['actions']>,
  alternateBackground?: string,
): DataRow {
  const { accountAddress, percentage } = holder;
  const rank: DataColumn = {
    key: 'rank',
    text: `${layout.wide ? '#' : ''}${index + 1}`,
    tone: 'secondary',
  };
  const address: DataColumn = {
    key: 'address',
    text: accountUtils.shortenAddress({
      address: accountAddress,
      leadingLength: 6,
      trailingLength: 4,
    }),
  };
  const share: DataColumn = {
    key: 'share',
    text: holderPercentage(percentage),
    alignment: 'end',
  };
  const fiat: DataColumn = {
    key: 'value',
    ...formattedAmount(holder.fiatValue, '$'),
    alignment: 'end',
  };
  return {
    type: 'dataRow',
    key: holderRowKey(networkId, accountAddress),
    height: layout.wide ? 40 : 52,
    separator: false,
    backgroundColor: layout.wide && index % 2 ? alternateBackground : undefined,
    columns: [rank, address, share, fiat],
    tableColumns: [
      { ...rank, width: layout.rankWidth },
      {
        ...address,
        width: layout.addressWidth,
        actions,
        actionPlacement: layout.wide ? 'inline' : 'below',
      },
      { ...share, width: layout.percentageWidth },
      ...(layout.wide
        ? [
            {
              key: 'amount',
              width: layout.amountWidth,
              ...formattedAmount(holder.amount),
              alignment: 'end' as const,
            },
          ]
        : []),
      { ...fiat, width: layout.valueWidth },
    ],
    style: {
      horizontalPadding: layout.padding,
      verticalPadding: 0,
      columnGap: layout.gap,
      columns: { fontSize: 14, lineHeight: 20, fontWeight: 'regular' },
    },
  };
}
