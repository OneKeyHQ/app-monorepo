import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  onChangeAsset?: () => void;
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
  if (val > 0) return '$green11';
  if (val < 0) return '$red11';
  return undefined;
}

// Only add suffix to the perps side when the same coin appears in both spot and
// perps (e.g. USDC). Spot keeps the plain symbol in both desktop and mobile UI.
function getCoinLabel(item: IBalanceDisplayItem, perpLabel: string): string {
  if (!item.needsSuffix) return item.coin;
  return item.type === 'perps' ? `${item.coin} (${perpLabel})` : item.coin;
}

function ContractAddressCell({
  contract,
  size = '$bodyXs',
}: {
  contract?: string;
  size?: '$bodyXs' | '$bodySmMedium';
}) {
  const { copyText } = useClipboard();
  if (!contract) return null;
  const shortened = `${contract.slice(0, 6)}...${contract.slice(-4)}`;
  return (
    <XStack gap="$1" alignItems="center">
      <SizableText size={size} color="$textSubdued" fontFamily="$monoRegular">
        {shortened}
      </SizableText>
      <IconButton
        size="small"
        variant="tertiary"
        icon="Copy3Outline"
        iconProps={{ size: '$3', color: '$iconSubdued' }}
        onPress={(e) => {
          e?.stopPropagation?.();
          copyText(contract);
        }}
      />
    </XStack>
  );
}

function BalanceRowMobile({ item, onChangeAsset }: IBalanceRowProps) {
  const intl = useIntl();
  const label = getCoinLabel(
    item,
    intl.formatMessage({
      id: ETranslations.perp_label_perp,
    }),
  );
  const pnlText = formatPnlText(item.pnl, item.pnlPercent);
  const pnlColor = getPnlColor(item.pnl);
  const isAssetClickable = !!item.isAssetClickable;
  const balanceText = item.total;

  return (
    <ListItem py="$2" px="$4" mx="$0">
      <XStack
        flex={1}
        minWidth={0}
        alignItems="center"
        justifyContent="space-between"
        gap="$3"
      >
        <XStack
          flexGrow={1}
          flexBasis={0}
          minWidth={0}
          alignItems="center"
          gap="$3"
        >
          <Token size="md" tokenImageUri={item.logoURI} />
          <YStack flex={1} minWidth={0} gap="$0.5">
            <XStack
              minWidth={0}
              alignItems="center"
              gap="$1"
              onPress={isAssetClickable ? onChangeAsset : undefined}
            >
              <SizableText
                size="$bodyMdMedium"
                fontWeight={600}
                numberOfLines={1}
              >
                {label}
              </SizableText>
              {isAssetClickable ? (
                <Icon
                  name="ChevronRightSmallOutline"
                  size="$3.5"
                  color="$iconSubdued"
                />
              ) : null}
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {balanceText}
            </SizableText>
          </YStack>
        </XStack>
        <YStack flexShrink={0} alignItems="flex-end" gap="$0.5">
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="value"
            formatterOptions={{ currency: '$' }}
            numberOfLines={1}
            textAlign="right"
          >
            {item.usdcValue}
          </NumberSizeableText>
          {pnlText ? (
            <SizableText
              size="$bodySm"
              color={pnlColor}
              numberOfLines={1}
              textAlign="right"
            >
              {pnlText}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
    </ListItem>
  );
}

function BalanceRowDesktop({
  item,
  columnConfigs,
  index,
  onChangeAsset,
}: IBalanceRowProps) {
  const intl = useIntl();
  const label = getCoinLabel(
    item,
    intl.formatMessage({
      id: ETranslations.perp_label_perp,
    }),
  );
  const pnlText = formatPnlText(item.pnl, item.pnlPercent);
  const pnlColor = getPnlColor(item.pnl);
  const isAssetClickable = !!item.isAssetClickable;

  const cells = useMemo(() => {
    const cellValues: Record<string, string> = {
      coin: label,
      total: `${item.total} ${item.coin}`,
      available: `${item.available} ${item.coin}`,
      usdcValue: numberFormat(item.usdcValue, balanceCurrencyFormatter),
      pnl: pnlText,
      contract: '',
    };
    return columnConfigs.map((col) => ({
      ...col,
      cellValue: cellValues[col.key] || '',
    }));
  }, [item, label, pnlText, columnConfigs]);

  const renderCellContent = (cell: (typeof cells)[number]) => {
    if (cell.key === 'contract') {
      return (
        <ContractAddressCell contract={item.contract} size="$bodySmMedium" />
      );
    }

    if (cell.key === 'coin') {
      return (
        <SizableText
          size="$bodySmMedium"
          fontWeight={600}
          color={isAssetClickable ? '$green11' : undefined}
          onPress={onChangeAsset}
          cursor={isAssetClickable ? 'pointer' : 'default'}
          hoverStyle={isAssetClickable ? { fontWeight: 600 } : undefined}
          pressStyle={isAssetClickable ? { fontWeight: 600 } : undefined}
        >
          {cell.cellValue}
        </SizableText>
      );
    }

    return (
      <SizableText
        size="$bodySmMedium"
        color={cell.key === 'pnl' ? pnlColor : undefined}
      >
        {cell.cellValue}
      </SizableText>
    );
  };

  return (
    <XStack
      width="100%"
      py="$1.5"
      px="$5"
      minHeight={48}
      bg={index % 2 === 0 ? '$bgApp' : '$bgSubdued'}
      hoverStyle={{ bg: '$bgHover' }}
    >
      {cells.map((cell) => (
        <XStack
          key={cell.key}
          {...getColumnStyle(cell)}
          alignItems="center"
          justifyContent={calcCellAlign(cell.align)}
        >
          {renderCellContent(cell)}
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
