import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IDebugRenderTrackerProps } from '@onekeyhq/components';
import {
  Badge,
  DashText,
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAbstractionModeAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsComputedAccountValueAtom,
  useSpotAssetCtxsMapAtom,
  useSpotBalancesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  getHyperliquidTokenImageUrl,
  getSpotTokenDisplayName,
  getValidPriceDecimals,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid';

import { useShowDepositWithdrawModal } from '../../../hooks/useShowDepositWithdrawModal';
import { useSpotMetaMaps } from '../../../hooks/useSpotMetaMaps';
import { PerpTestIDs } from '../../../testIDs';
import { isHyperLiquidUnifiedAccountMode } from '../../../utils';
import { BalanceRow } from '../Components/BalanceRow';
import { PerpHoldingsEmptyState } from '../Components/PerpHoldingsEmptyState';
import { calculateSpotHoldingPnl, isSpotHoldingStableCoin } from '../utils';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

export interface IBalanceDisplayItem {
  coin: string;
  rawCoin: string;
  type: 'spot' | 'perps';
  total: string;
  available: string;
  usdcValue: string;
  pnl?: string;
  pnlPercent?: number;
  entryPrice?: string;
  markPrice?: string;
  contract?: string;
  logoURI?: string;
  usdcValueNum: number;
  spotUniverse?: ISpotUniverse;
  isAssetClickable?: boolean;
  // True when the same coin appears in both spot and perps (e.g. USDC)
  needsSuffix: boolean;
}

const ZERO_USDC_BALANCE: IBalanceDisplayItem = {
  coin: 'USDC',
  rawCoin: 'USDC',
  type: 'spot',
  total: '0',
  available: '0',
  usdcValue: '0',
  logoURI: getHyperliquidTokenImageUrl('USDC'),
  isAssetClickable: false,
  needsSuffix: false,
  usdcValueNum: 0,
};

const ZERO_USDC_BALANCES = [ZERO_USDC_BALANCE];

interface ISpotBalanceListProps {
  isMobile?: boolean;
  useTabsList?: boolean;
  disableListScroll?: boolean;
  ListHeaderComponent?: ReactElement | null;
}

function getBalanceSortPriority(item: IBalanceDisplayItem): number {
  if (item.coin !== 'USDC') {
    return 2;
  }

  return item.type === 'spot' ? 0 : 1;
}

function SpotBalanceList({
  isMobile,
  useTabsList,
  disableListScroll,
  ListHeaderComponent,
}: ISpotBalanceListProps) {
  const intl = useIntl();
  const [{ balances, isLoaded }] = useSpotBalancesAtom();
  const [computedValue] = usePerpsComputedAccountValueAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const [abstractionMode] = usePerpsAbstractionModeAtom();
  const [priceMap] = useSpotAssetCtxsMapAtom();
  const actions = useHyperliquidActions();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();
  const { spotUniverses, universeByBaseName, tokenContractMap } =
    useSpotMetaMaps();
  const [currentListPage, setCurrentListPage] = useState(1);

  useEffect(() => {
    setCurrentListPage(1);
  }, [currentUser?.accountAddress]);

  const tokenPriceLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    // First pass: prefer USDC-quoted pairs for accurate USD value
    for (const u of spotUniverses) {
      if (u.quoteName === 'USDC') {
        const ctx = priceMap[u.name];
        if (ctx?.markPx) {
          lookup[u.baseName] = ctx.markPx;
        }
      }
    }
    // Second pass: fill remaining from any quote
    for (const u of spotUniverses) {
      if (!lookup[u.baseName]) {
        const ctx = priceMap[u.name];
        if (ctx?.markPx) {
          lookup[u.baseName] = ctx.markPx;
        }
      }
    }
    return lookup;
  }, [priceMap, spotUniverses]);

  const isUnifiedAccountMode = isHyperLiquidUnifiedAccountMode(
    abstractionMode,
    currentUser?.accountAddress,
  );

  const allBalances: IBalanceDisplayItem[] = useMemo(() => {
    const items: IBalanceDisplayItem[] = [];

    let spotUsdcBalance: (typeof balances)[number] | undefined;

    balances.forEach((b) => {
      // USDC is merged with the perps-side USDC after the loop into a single
      // total-across-spot+perps row; defer collection until then.
      if (b.coin === 'USDC') {
        spotUsdcBalance = b;
        return;
      }

      const totalBN = new BigNumber(b.total);
      const holdBN = new BigNumber(b.hold);
      const availableBN = BigNumber.max(totalBN.minus(holdBN), 0);
      const entryNtlBN = new BigNumber(b.entryNtl || '0');

      const isStable = isSpotHoldingStableCoin(b.coin);

      const midPrice = tokenPriceLookup[b.coin];
      let usdcValueBN: BigNumber;
      if (isStable) {
        usdcValueBN = totalBN;
      } else if (midPrice) {
        usdcValueBN = totalBN.multipliedBy(midPrice);
      } else {
        usdcValueBN = entryNtlBN;
      }

      const { pnl, pnlPercent } = calculateSpotHoldingPnl({
        total: b.total,
        entryNtl: b.entryNtl,
        midPrice,
        isStable,
      });
      const entryPriceBN =
        !isStable && totalBN.isFinite() && totalBN.gt(0) && entryNtlBN.gt(0)
          ? entryNtlBN.dividedBy(totalBN)
          : undefined;
      const markPriceBN =
        !isStable && midPrice ? new BigNumber(midPrice) : undefined;
      const entryPrice =
        entryPriceBN?.isFinite() && entryPriceBN.gt(0)
          ? entryPriceBN.toFixed(getValidPriceDecimals(entryPriceBN.toFixed()))
          : undefined;
      const markPrice =
        markPriceBN?.isFinite() && markPriceBN.gt(0)
          ? markPriceBN.toFixed(getValidPriceDecimals(markPriceBN.toFixed()))
          : undefined;

      const displayCoin = getSpotTokenDisplayName(b.coin);
      const spotUniverse = universeByBaseName[b.coin];
      const isAssetClickable = !!spotUniverse;

      items.push({
        coin: displayCoin,
        rawCoin: b.coin,
        type: 'spot',
        total: b.total,
        available: availableBN.toFixed(),
        usdcValue: usdcValueBN.toFixed(2),
        pnl,
        pnlPercent,
        entryPrice,
        markPrice,
        contract: tokenContractMap[b.coin],
        logoURI: getHyperliquidTokenImageUrl(b.coin),
        spotUniverse,
        isAssetClickable,
        needsSuffix: false,
        usdcValueNum: usdcValueBN.toNumber(),
      });
    });

    // HL doesn't expose a cross-account USDC total — sum on the client and
    // tag as 'spot' so it inherits the existing USDC-first sort priority.
    const spotUsdcTotalBN = spotUsdcBalance
      ? new BigNumber(spotUsdcBalance.total)
      : new BigNumber(0);
    const spotUsdcHoldBN = spotUsdcBalance
      ? new BigNumber(spotUsdcBalance.hold)
      : new BigNumber(0);
    const spotUsdcAvailBN = BigNumber.max(
      spotUsdcTotalBN.minus(spotUsdcHoldBN),
      0,
    );
    const perpsUsdcTotalBN = isUnifiedAccountMode
      ? new BigNumber(0)
      : new BigNumber(accountSummary?.totalRawUsd || '0');
    const perpsUsdcAvailBN = isUnifiedAccountMode
      ? new BigNumber(0)
      : new BigNumber(accountSummary?.withdrawable || '0');
    const mergedUsdcTotalBN = spotUsdcTotalBN.plus(perpsUsdcTotalBN);

    if (mergedUsdcTotalBN.isGreaterThan(0)) {
      items.push({
        coin: 'USDC',
        rawCoin: 'USDC',
        type: 'spot',
        total: mergedUsdcTotalBN.toFixed(),
        available: spotUsdcAvailBN.plus(perpsUsdcAvailBN).toFixed(),
        usdcValue: mergedUsdcTotalBN.toFixed(2),
        logoURI: getHyperliquidTokenImageUrl('USDC'),
        isAssetClickable: false,
        needsSuffix: false,
        usdcValueNum: mergedUsdcTotalBN.toNumber(),
      });
    }

    return items.toSorted((a, b) => {
      const priorityDiff =
        getBalanceSortPriority(a) - getBalanceSortPriority(b);
      if (priorityDiff !== 0) return priorityDiff;

      const valueDiff = Math.abs(b.usdcValueNum) - Math.abs(a.usdcValueNum);
      if (valueDiff !== 0) return valueDiff;
      return new BigNumber(b.total).comparedTo(new BigNumber(a.total));
    });
  }, [
    balances,
    accountSummary,
    tokenPriceLookup,
    tokenContractMap,
    universeByBaseName,
    isUnifiedAccountMode,
  ]);

  // Filter out zero-balance tokens
  const filteredBalances = useMemo(
    () => allBalances.filter((b) => !new BigNumber(b.total).isZero()),
    [allBalances],
  );
  const displayBalances =
    isMobile &&
    currentUser?.accountAddress &&
    isLoaded &&
    filteredBalances.length === 0
      ? ZERO_USDC_BALANCES
      : filteredBalances;

  const columnsConfig: IColumnConfig[] = useMemo(
    () => [
      {
        key: 'coin',
        title: intl.formatMessage({ id: ETranslations.global_asset }),
        minWidth: 120,
        align: 'left',
      },
      {
        key: 'total',
        title: intl.formatMessage({ id: ETranslations.global_balance }),
        minWidth: 160,
        align: 'left',
        flex: 1,
      },
      {
        key: 'available',
        title: intl.formatMessage({ id: ETranslations.global_available }),
        minWidth: 160,
        align: 'left',
        flex: 1,
      },
      {
        key: 'usdcValue',
        title: intl.formatMessage({ id: ETranslations.global_value }),
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'pnl',
        title: intl.formatMessage({
          id: ETranslations.perp_position_pnl,
        }),
        minWidth: 140,
        align: 'left',
        flex: 1,
      },
      {
        key: 'contract',
        title: intl.formatMessage({ id: ETranslations.global_contract }),
        minWidth: 120,
        align: 'left',
        flex: 1,
      },
    ],
    [intl],
  );

  const totalMinWidth = useMemo(
    () =>
      columnsConfig.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [columnsConfig],
  );

  const renderBalanceRow = useCallback(
    (item: IBalanceDisplayItem, index: number) => (
      <BalanceRow
        key={`${item.coin}-${item.type}`}
        item={item}
        isMobile={isMobile}
        columnConfigs={columnsConfig}
        index={index}
        onChangeAsset={
          item.isAssetClickable && item.spotUniverse
            ? () => {
                void actions.current.changeActiveSpotAsset({
                  coin: item.spotUniverse!.name,
                  spotUniverse: item.spotUniverse,
                });
              }
            : undefined
        }
      />
    ),
    [actions, isMobile, columnsConfig],
  );

  const mobileHeaderComponent = useMemo(() => {
    if (!isMobile) {
      return ListHeaderComponent ?? null;
    }

    const accountValue = computedValue.isLoading
      ? '--'
      : (computedValue.accountValue ?? '0');
    const availableValue = computedValue.isLoading
      ? '--'
      : (computedValue.withdrawable ?? '0');

    return (
      <>
        {ListHeaderComponent}
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$4"
          px="$4"
          pt="$4"
          pb="$2"
        >
          <YStack flex={1} minWidth={0} gap="$1">
            <SizableText
              size="$bodyXs"
              color="$textSubdued"
              textTransform="uppercase"
            >
              {intl.formatMessage({ id: ETranslations.perp_portfolio_value })}
            </SizableText>
            <NumberSizeableText
              size="$heading2xl"
              formatter="value"
              formatterOptions={{ currency: '$' }}
              numberOfLines={1}
            >
              {accountValue}
            </NumberSizeableText>
            <XStack gap="$1" alignItems="center">
              <SizableText size="$bodyXs" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_portfolio_available,
                })}
              </SizableText>
              <NumberSizeableText
                size="$bodyXs"
                color="$textSubdued"
                formatter="value"
                formatterOptions={{ currency: '$' }}
                numberOfLines={1}
              >
                {availableValue}
              </NumberSizeableText>
            </XStack>
          </YStack>
          <Badge
            testID={PerpTestIDs.HoldingsEmptyDepositButton}
            borderRadius="$full"
            size="medium"
            variant="primary"
            alignItems="center"
            justifyContent="center"
            flexDirection="row"
            gap="$2"
            px="$3"
            h={28}
            bg="$brand8"
            onPress={
              currentUser?.accountAddress
                ? () => void showDepositWithdrawModal('deposit')
                : undefined
            }
          >
            <Icon name="AlignBottomOutline" size="$4" color="$iconOnColor" />
            <SizableText size="$bodySmMedium" color="$textOnColor">
              {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
            </SizableText>
          </Badge>
        </XStack>
        <XStack alignItems="center" gap="$3" px="$4" pt="$1.5" pb="$2">
          <XStack flexGrow={1} flexBasis={0} alignItems="center" gap="$1">
            <SizableText
              size="$bodyXs"
              color="$textSubdued"
              textTransform="uppercase"
            >
              {intl.formatMessage({ id: ETranslations.global_name })}
            </SizableText>
            <SizableText
              size="$bodyXs"
              color="$textSubdued"
              textTransform="uppercase"
            >
              /
            </SizableText>
            <SizableText
              size="$bodyXs"
              color="$textSubdued"
              textTransform="uppercase"
            >
              {intl.formatMessage({ id: ETranslations.global_balance })}
            </SizableText>
          </XStack>
          <XStack
            flexGrow={1}
            flexBasis={0}
            justifyContent="flex-end"
            gap="$1"
            alignItems="center"
          >
            <SizableText
              size="$bodyXs"
              color="$textSubdued"
              textTransform="uppercase"
            >
              {`${intl.formatMessage({ id: ETranslations.global_value })} / `}
            </SizableText>
            <DashText
              size="$bodyXs"
              color="$textSubdued"
              textTransform="uppercase"
              dashThickness={0.5}
              tooltip={intl.formatMessage({
                id: ETranslations.marketdex_un_pnl,
              })}
              tooltipTitle={intl.formatMessage({
                id: ETranslations.marketdex_unrealized_pnl,
              })}
            >
              {intl.formatMessage({
                id: ETranslations.perp_position_pnl_mobile,
              })}
            </DashText>
          </XStack>
        </XStack>
      </>
    );
  }, [
    ListHeaderComponent,
    computedValue.accountValue,
    computedValue.isLoading,
    computedValue.withdrawable,
    currentUser?.accountAddress,
    intl,
    isMobile,
    showDepositWithdrawModal,
  ]);

  return (
    <CommonTableListView
      onPullToRefresh={async () => {
        await actions.current.refreshAllPerpsData();
      }}
      listViewDebugRenderTrackerProps={useMemo(
        (): IDebugRenderTrackerProps => ({
          name: 'SpotBalanceList',
          position: 'top-left',
        }),
        [],
      )}
      useTabsList={useTabsList}
      disableListScroll={disableListScroll}
      currentListPage={currentListPage}
      setCurrentListPage={setCurrentListPage}
      enablePagination={!isMobile}
      columns={columnsConfig}
      minTableWidth={totalMinWidth}
      data={displayBalances}
      isMobile={isMobile}
      renderRow={renderBalanceRow}
      listLoading={
        !isMobile && currentUser?.accountAddress
          ? !isLoaded || computedValue.isLoading
          : false
      }
      emptyMessage={intl.formatMessage({
        id: ETranslations.global_no_data,
      })}
      emptySubMessage={intl.formatMessage({
        id: ETranslations.perp_trade_history_empty_desc,
      })}
      ListEmptyComponent={
        isMobile ? <></> : <PerpHoldingsEmptyState isMobile={isMobile} />
      }
      ListHeaderComponent={mobileHeaderComponent}
    />
  );
}

export { SpotBalanceList };
