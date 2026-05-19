import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
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
import { openHyperLiquidTokenExplorerUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { PerpTestIDs } from '@onekeyhq/kit/src/views/Perp/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { useShowPositionShare } from '../../../hooks/useShowPositionShare';
import {
  calcCellAlign,
  formatSpotHoldingPnlText,
  getColumnStyle,
} from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';
import type { IBalanceDisplayItem } from '../List/SpotBalanceList';

const valueCurrencyFormatter: INumberFormatProps = {
  formatter: 'value',
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

function getPnlColor(pnl?: string): string | undefined {
  if (!pnl) return undefined;
  const val = parseFloat(pnl);
  if (val > 0) return '$green11';
  if (val < 0) return '$red11';
  return undefined;
}

function canShareSpotHolding(item: IBalanceDisplayItem): boolean {
  const pnlBN = new BigNumber(item.pnl ?? '0');
  return (
    item.type === 'spot' &&
    !!item.entryPrice &&
    !!item.markPrice &&
    pnlBN.isFinite() &&
    !pnlBN.isZero()
  );
}

function useSpotHoldingShare({
  item,
  label,
}: {
  item: IBalanceDisplayItem;
  label: string;
}) {
  const { showPositionShare } = useShowPositionShare();
  const canShare = canShareSpotHolding(item);

  const handleShare = useCallback(() => {
    if (!canShare || !item.entryPrice || !item.markPrice) {
      return;
    }

    showPositionShare({
      mode: 'spot',
      side: 'long',
      token: item.rawCoin,
      tokenDisplayName: label,
      tokenImageUrl: item.logoURI,
      pnl: item.pnl ?? '0',
      pnlPercent: String(item.pnlPercent ?? 0),
      leverage: 1,
      entryPrice: item.entryPrice,
      markPrice: item.markPrice,
      priceType: 'mark',
    });
  }, [canShare, item, label, showPositionShare]);

  return { canShare, handleShare };
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
  if (!contract) {
    return (
      <SizableText size={size} color="$textSubdued">
        --
      </SizableText>
    );
  }
  const shortened = `${contract.slice(0, 6)}...${contract.slice(-4)}`;
  return (
    <XStack minWidth={0} gap="$1" alignItems="center">
      <SizableText
        size={size}
        color="$textSubdued"
        fontFamily="$monoRegular"
        numberOfLines={1}
      >
        {shortened}
      </SizableText>
      <IconButton
        testID={PerpTestIDs.BalanceRowCopyContractButton}
        size="small"
        variant="tertiary"
        icon="Copy3Outline"
        iconProps={{ size: '$3', color: '$iconSubdued' }}
        onPress={(e) => {
          e?.stopPropagation?.();
          copyText(contract);
        }}
      />
      <IconButton
        testID={PerpTestIDs.BalanceRowOpenContractButton}
        size="small"
        variant="tertiary"
        icon="OpenOutline"
        iconProps={{ size: '$3', color: '$iconSubdued' }}
        onPress={(e) => {
          e?.stopPropagation?.();
          void openHyperLiquidTokenExplorerUrl({ tokenId: contract });
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
  const pnlText = formatSpotHoldingPnlText(item.pnl, item.pnlPercent);
  const pnlColor = getPnlColor(item.pnl);
  const isAssetClickable = !!item.isAssetClickable;
  const balanceText = item.total;
  const { canShare, handleShare } = useSpotHoldingShare({ item, label });

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
            <XStack gap="$1" alignItems="center" justifyContent="flex-end">
              <SizableText
                size="$bodySm"
                color={pnlColor}
                numberOfLines={1}
                textAlign="right"
              >
                {pnlText}
              </SizableText>
              {canShare ? (
                <IconButton
                  testID={PerpTestIDs.BalanceRowShareButton}
                  variant="tertiary"
                  size="small"
                  icon="ShareOutline"
                  iconSize="$3.5"
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    handleShare();
                  }}
                />
              ) : null}
            </XStack>
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
  const pnlText = formatSpotHoldingPnlText(item.pnl, item.pnlPercent);
  const pnlColor = getPnlColor(item.pnl);
  const isAssetClickable = !!item.isAssetClickable;
  const { canShare, handleShare } = useSpotHoldingShare({ item, label });

  const cells = useMemo(() => {
    const cellValues: Record<string, string> = {
      coin: label,
      total: `${item.total} ${item.coin}`,
      available: `${item.available} ${item.coin}`,
      usdcValue: numberFormat(item.usdcValue, valueCurrencyFormatter),
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
        <XStack
          minWidth={0}
          alignItems="center"
          gap="$2"
          onPress={isAssetClickable ? onChangeAsset : undefined}
          cursor={isAssetClickable ? 'pointer' : 'default'}
        >
          <Token size="xs" tokenImageUri={item.logoURI} />
          <SizableText
            size="$bodySmMedium"
            fontWeight={600}
            color={isAssetClickable ? '$green11' : undefined}
            numberOfLines={1}
            hoverStyle={isAssetClickable ? { fontWeight: 600 } : undefined}
            pressStyle={isAssetClickable ? { fontWeight: 600 } : undefined}
          >
            {cell.cellValue}
          </SizableText>
        </XStack>
      );
    }

    if (cell.key === 'pnl') {
      return (
        <XStack minWidth={0} alignItems="center" gap="$1">
          <SizableText size="$bodySmMedium" color={pnlColor} numberOfLines={1}>
            {cell.cellValue}
          </SizableText>
          {canShare ? (
            <IconButton
              testID={PerpTestIDs.BalanceRowShareButton}
              variant="tertiary"
              size="small"
              icon="ShareOutline"
              iconSize="$3.5"
              onPress={(e) => {
                e?.stopPropagation?.();
                handleShare();
              }}
              hoverStyle={null}
              pressStyle={null}
            />
          ) : null}
        </XStack>
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
      pl="$5"
      pr="$3"
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
          <XStack
            width="100%"
            minWidth={0}
            alignItems="center"
            justifyContent={calcCellAlign(cell.align)}
          >
            {renderCellContent(cell)}
          </XStack>
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
