import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IDebugRenderTrackerProps } from '@onekeyhq/components';
import { DashText, SizableText, XStack } from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  useSpotAssetCtxsMapAtom,
  useSpotBalancesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  getHyperliquidTokenImageUrl,
  getSpotTokenDisplayName,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid';

import { useSpotMetaMaps } from '../../../hooks/useSpotMetaMaps';
import { BalanceRow } from '../Components/BalanceRow';

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
  contract?: string;
  logoURI?: string;
  usdcValueNum: number;
  spotUniverse?: ISpotUniverse;
  isAssetClickable?: boolean;
  // True when the same coin appears in both spot and perps (e.g. USDC)
  needsSuffix: boolean;
}

interface ISpotBalanceListProps {
  isMobile?: boolean;
  useTabsList?: boolean;
  disableListScroll?: boolean;
  ListHeaderComponent?: ReactElement | null;
}

function SpotBalanceList({
  isMobile,
  useTabsList,
  disableListScroll,
  ListHeaderComponent,
}: ISpotBalanceListProps) {
  const intl = useIntl();
  const [{ balances, isLoaded }] = useSpotBalancesAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const [priceMap] = useSpotAssetCtxsMapAtom();
  const actions = useHyperliquidActions();
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

  const allBalances: IBalanceDisplayItem[] = useMemo(() => {
    const items: IBalanceDisplayItem[] = [];

    const spotCoinNames = new Set(balances.map((b) => b.coin));
    const hasPerpsUsdc = !!accountSummary?.totalRawUsd;

    balances.forEach((b) => {
      const totalBN = new BigNumber(b.total);
      const holdBN = new BigNumber(b.hold);
      const availableBN = BigNumber.max(totalBN.minus(holdBN), 0);
      const entryNtlBN = new BigNumber(b.entryNtl || '0');

      const isStable =
        b.coin === 'USDC' || b.coin === 'USDT' || b.coin === 'USDB';

      const midPrice = tokenPriceLookup[b.coin];
      let usdcValueBN: BigNumber;
      if (isStable) {
        usdcValueBN = totalBN;
      } else if (midPrice) {
        usdcValueBN = totalBN.multipliedBy(midPrice);
      } else {
        usdcValueBN = entryNtlBN;
      }

      let pnl: string | undefined;
      let pnlPercent: number | undefined;
      if (!isStable && !entryNtlBN.isZero() && midPrice) {
        const pnlBN = usdcValueBN.minus(entryNtlBN);
        pnl = pnlBN.toFixed(2);
        pnlPercent = pnlBN.dividedBy(entryNtlBN).multipliedBy(100).toNumber();
      }

      const displayCoin = getSpotTokenDisplayName(b.coin);
      const needsSuffix = displayCoin === 'USDC' && hasPerpsUsdc;
      const spotUniverse = universeByBaseName[b.coin];
      const isAssetClickable = b.coin !== 'USDC' && !!spotUniverse;

      items.push({
        coin: displayCoin,
        rawCoin: b.coin,
        type: 'spot',
        total: b.total,
        available: availableBN.toFixed(),
        usdcValue: usdcValueBN.toFixed(2),
        pnl,
        pnlPercent,
        contract: tokenContractMap[b.coin],
        logoURI: getHyperliquidTokenImageUrl(b.coin),
        spotUniverse,
        isAssetClickable,
        needsSuffix,
        usdcValueNum: usdcValueBN.toNumber(),
      });
    });

    if (accountSummary?.totalRawUsd) {
      const perpsUsdcBN = new BigNumber(accountSummary.totalRawUsd);
      if (perpsUsdcBN.isGreaterThan(0)) {
        items.push({
          coin: 'USDC',
          rawCoin: 'USDC',
          type: 'perps',
          total: perpsUsdcBN.toFixed(),
          available: accountSummary.withdrawable || '0',
          usdcValue: perpsUsdcBN.toFixed(2),
          logoURI: getHyperliquidTokenImageUrl('USDC'),
          isAssetClickable: false,
          needsSuffix: spotCoinNames.has('USDC'),
          usdcValueNum: perpsUsdcBN.toNumber(),
        });
      }
    }

    return items.toSorted((a, b) => {
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
  ]);

  // Filter out zero-balance tokens
  const filteredBalances = useMemo(
    () => allBalances.filter((b) => !new BigNumber(b.total).isZero()),
    [allBalances],
  );

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
        // TODO: add i18n key — domain term consistent with Hyperliquid UI
        title: 'PNL (ROE %)',
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
    if (!isMobile || filteredBalances.length === 0) {
      return ListHeaderComponent ?? null;
    }

    return (
      <>
        {ListHeaderComponent}
        <XStack alignItems="center" gap="$3" px="$4" pt="$3" pb="$2.5">
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
              dashColor="$textDisabled"
              dashThickness={0.5}
              tooltip={intl.formatMessage({
                id: ETranslations.marketdex_un_pnl,
              })}
              tooltipTitle={intl.formatMessage({
                id: ETranslations.marketdex_unrealized_pnl,
              })}
            >
              PnL
            </DashText>
          </XStack>
        </XStack>
      </>
    );
  }, [ListHeaderComponent, filteredBalances.length, intl, isMobile]);

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
      data={filteredBalances}
      isMobile={isMobile}
      renderRow={renderBalanceRow}
      listLoading={currentUser?.accountAddress ? !isLoaded : false}
      emptyMessage={intl.formatMessage({
        id: ETranslations.global_no_data,
      })}
      emptySubMessage={intl.formatMessage({
        id: ETranslations.perp_trade_history_empty_desc,
      })}
      ListHeaderComponent={mobileHeaderComponent}
    />
  );
}

export { SpotBalanceList };
