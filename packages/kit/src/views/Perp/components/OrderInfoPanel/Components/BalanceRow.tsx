import { memo, useMemo } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { calcCellAlign, getColumnStyle } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';
import type { IBalanceDisplayItem } from '../List/SpotBalanceList';

const balanceCurrencyFormatter: INumberFormatProps = {
  formatter: 'balance',
  formatterOptions: {
    currency: '$',
  },
};

interface IBalanceRowProps {
  item: IBalanceDisplayItem;
  columnConfigs: IColumnConfig[];
  isMobile?: boolean;
  index: number;
}

function formatPnlText(pnl?: string, pnlPercent?: number): string {
  if (!pnl || parseFloat(pnl) === 0) return '';
  const sign = parseFloat(pnl) > 0 ? '+' : '';
  const formatted = numberFormat(pnl, balanceCurrencyFormatter);
  const pct = pnlPercent?.toFixed(1) ?? '0';
  return `${sign}${formatted} (${sign}${pct}%)`;
}

function getPnlColor(pnl?: string): string | undefined {
  if (!pnl) return undefined;
  const val = parseFloat(pnl);
  if (val > 0) return '$textSuccess';
  if (val < 0) return '$textCritical';
  return undefined;
}

// Only add suffix when the same coin appears in both spot and perps (e.g. USDC).
// Other tokens show without suffix, matching Hyperliquid's convention.
function getCoinLabel(item: IBalanceDisplayItem): string {
  if (!item.needsSuffix) return item.coin;
  // TODO: add i18n keys for "Perps" / "Spot" suffixes
  return item.type === 'perps' ? `${item.coin} (Perps)` : `${item.coin} (Spot)`;
}

function BalanceRowMobile({ item }: IBalanceRowProps) {
  const label = getCoinLabel(item);
  const pnlText = formatPnlText(item.pnl, item.pnlPercent);
  const pnlColor = getPnlColor(item.pnl);

  return (
    <ListItem py="$2.5" px="$5">
      <YStack flex={1} gap="$0.5">
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMdMedium">{label}</SizableText>
          <SizableText size="$bodyMdMedium">
            {numberFormat(item.usdcValue, balanceCurrencyFormatter)}
          </SizableText>
        </XStack>
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodySm" color="$textSubdued">
            {`${item.total} ${item.coin}`}
          </SizableText>
          {pnlText ? (
            <SizableText size="$bodySm" color={pnlColor}>
              {pnlText}
            </SizableText>
          ) : null}
        </XStack>
      </YStack>
    </ListItem>
  );
}

function BalanceRowDesktop({ item, columnConfigs, index }: IBalanceRowProps) {
  const label = getCoinLabel(item);
  const pnlText = formatPnlText(item.pnl, item.pnlPercent);
  const pnlColor = getPnlColor(item.pnl);

  const cells = useMemo(() => {
    const cellValues: Record<string, string> = {
      coin: label,
      total: `${item.total} ${item.coin}`,
      available: `${item.available} ${item.coin}`,
      usdcValue: numberFormat(item.usdcValue, balanceCurrencyFormatter),
      pnl: pnlText,
      contract: item.contract
        ? `${item.contract.slice(0, 6)}...${item.contract.slice(-4)}`
        : '',
    };
    return columnConfigs.map((col) => ({
      ...col,
      cellValue: cellValues[col.key] || '',
    }));
  }, [item, label, pnlText, columnConfigs]);

  return (
    <XStack
      py="$2"
      px="$5"
      bg={index % 2 === 0 ? '$bgApp' : '$bg'}
      hoverStyle={{ bg: '$bgHover' }}
    >
      {cells.map((cell) => (
        <XStack
          key={cell.key}
          {...getColumnStyle(cell)}
          alignItems="center"
          justifyContent={calcCellAlign(cell.align)}
        >
          <SizableText
            size="$bodySmMedium"
            color={cell.key === 'pnl' ? pnlColor : undefined}
          >
            {cell.cellValue}
          </SizableText>
        </XStack>
      ))}
    </XStack>
  );
}

function BalanceRowInner({ isMobile, ...rest }: IBalanceRowProps) {
  if (isMobile) {
    return <BalanceRowMobile isMobile={isMobile} {...rest} />;
  }
  return <BalanceRowDesktop {...rest} />;
}

export const BalanceRow = memo(BalanceRowInner);
