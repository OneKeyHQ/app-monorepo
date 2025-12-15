import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import {
  Button,
  NumberSizeableText,
  Skeleton,
  Stack,
  YStack,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EmptyDeFi } from '@onekeyhq/kit/src/components/Empty';
import { ListLoading } from '@onekeyhq/kit/src/components/Loading';
import { useAllNetworkRequests } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useDeFiListActions,
  useDeFiListOverviewAtom,
  useDeFiListProtocolsAtom,
  useDeFiListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_DEFI,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { RichBlock } from '../RichBlock/RichBlock';

import { Protocol } from './Protocol';

const MAX_PROTOCOLS_ON_SMALL_SCREEN = 6;

function DeFiListBlock({ tableLayout }: { tableLayout?: boolean }) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();

  const {
    updateDeFiListOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  } = useDeFiListActions().current;

  const { isFocused, isHeaderRefreshing } = useTabIsRefreshingFocused();

  const [overview] = useDeFiListOverviewAtom();
  const [{ isRefreshing, initialized }] = useDeFiListStateAtom();
  const [{ protocols }] = useDeFiListProtocolsAtom();

  const [overflowState, setOverflowState] = useState<{
    isOverflow: boolean;
    isSliced: boolean;
  }>({
    isOverflow: false,
    isSliced: true,
  });

  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const { run } = usePromiseResult(
    async () => {
      if (!account || !network) {
        return;
      }

      if (networkUtils.isAllNetwork({ networkId: network.id })) {
        return;
      }

      await backgroundApiProxy.serviceDeFi.abortFetchAccountDeFiPositions();

      try {
        const resp =
          await backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
            accountId: account.id,
            networkId: network.id,
            accountAddress: account.address,
            excludeLowValueProtocols: true,
          });
        updateDeFiListOverview({
          overview: {
            totalValue: new BigNumber(resp.overview.totalValue ?? 0).toFixed(),
            totalDebt: new BigNumber(resp.overview.totalDebt ?? 0).toFixed(),
            netWorth: new BigNumber(resp.overview.netWorth ?? 0).toFixed(),
            chains: resp.overview.chains,
            protocolCount: resp.overview.protocolCount,
            positionCount: resp.overview.positionCount,
          },
        });
        updateDeFiListProtocols({
          protocols: resp.protocols,
        });
        updateDeFiListProtocolMap({
          protocolMap: resp.protocolMap,
        });
      } catch (e) {
        console.error(e);
      } finally {
        updateDeFiListState({
          isRefreshing: false,
          initialized: true,
        });
      }
    },
    [
      account,
      network,
      updateDeFiListOverview,
      updateDeFiListProtocols,
      updateDeFiListProtocolMap,
      updateDeFiListState,
    ],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      revalidateOnFocus: true,
      pollingInterval: POLLING_INTERVAL_FOR_DEFI,
    },
  );

  const deFiDataRef = useRef<{
    overview: {
      totalValue: string;
      totalDebt: string;
      netWorth: string;
      chains: string[];
      protocolCount: number;
      positionCount: number;
    };
    protocols: IDeFiProtocol[];
  }>(defiUtils.getEmptyDeFiData());

  const updateAllNetworkData = useThrottledCallback(() => {
    updateDeFiListOverview({
      overview: deFiDataRef.current.overview,
      merge: true,
    });
    updateDeFiListProtocols({
      protocols: deFiDataRef.current.protocols,
      merge: true,
    });
    deFiDataRef.current = defiUtils.getEmptyDeFiData();
  }, 1000);

  const handleAllNetworkRequests = useCallback(
    async ({
      accountId,
      networkId,
      allNetworkDataInit,
    }: {
      accountId: string;
      networkId: string;
      allNetworkDataInit?: boolean;
    }) => {
      const r = await backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
        accountId,
        networkId,
        isAllNetworks: true,
        allNetworksAccountId: account?.id,
        allNetworksNetworkId: network?.id,
        saveToLocal: true,
        excludeLowValueProtocols: true,
      });

      if (!allNetworkDataInit && r.isSameAllNetworksAccountData) {
        deFiDataRef.current = {
          overview: {
            totalValue: new BigNumber(r.overview.totalValue ?? 0)
              .plus(deFiDataRef.current.overview.totalValue)
              .toFixed(),
            totalDebt: new BigNumber(r.overview.totalDebt ?? 0)
              .plus(deFiDataRef.current.overview.totalDebt)
              .toFixed(),
            netWorth: new BigNumber(r.overview.netWorth ?? 0)
              .plus(deFiDataRef.current.overview.netWorth)
              .toFixed(),
            chains: Array.from(
              new Set([
                ...deFiDataRef.current.overview.chains,
                ...r.overview.chains,
              ]),
            ),
            protocolCount:
              deFiDataRef.current.overview.protocolCount +
              r.overview.protocolCount,
            positionCount:
              deFiDataRef.current.overview.positionCount +
              r.overview.positionCount,
          },
          protocols: [...deFiDataRef.current.protocols, ...r.protocols],
        };
        updateDeFiListProtocolMap({
          protocolMap: r.protocolMap,
          merge: true,
        });
        updateAllNetworkData();
        updateDeFiListState({
          initialized: true,
          isRefreshing: false,
        });
      }

      return r;
    },
    [
      updateDeFiListState,
      account?.id,
      network?.id,
      updateAllNetworkData,
      updateDeFiListProtocolMap,
    ],
  );

  const handleClearAllNetworkData = useCallback(() => {
    updateDeFiListOverview({
      overview: {
        totalValue: '0',
        totalDebt: '0',
        netWorth: '0',
        chains: [],
        protocolCount: 0,
        positionCount: 0,
      },
    });
    updateDeFiListProtocols({
      protocols: [],
    });
    updateDeFiListProtocolMap({
      protocolMap: {},
    });
  }, [
    updateDeFiListOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
  ]);

  const {
    run: runAllNetworkRequests,
    result: allNetworksResult,
    isEmptyAccount,
  } = useAllNetworkRequests<
    Awaited<
      ReturnType<
        typeof backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions
      >
    >
  >({
    accountId: account?.id,
    networkId: network?.id,
    walletId: wallet?.id,
    isAllNetworks: network?.isAllNetworks,
    allNetworkRequests: handleAllNetworkRequests,
    clearAllNetworkData: handleClearAllNetworkData,
    isDeFiRequests: true,
  });

  const handleRefreshAllNetworkData = useCallback(() => {
    void runAllNetworkRequests({ alwaysSetState: true });
  }, [runAllNetworkRequests]);

  useEffect(() => {
    if (network?.isAllNetworks && isEmptyAccount) {
      updateDeFiListState({
        initialized: true,
        isRefreshing: false,
      });
      updateDeFiListOverview({
        overview: {
          totalValue: '0',
          totalDebt: '0',
          netWorth: '0',
          chains: [],
          protocolCount: 0,
          positionCount: 0,
        },
      });
      updateDeFiListProtocols({
        protocols: [],
      });
      updateDeFiListProtocolMap({
        protocolMap: {},
      });
    }
  }, [
    isEmptyAccount,
    network?.isAllNetworks,
    updateDeFiListState,
    updateDeFiListOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
  ]);

  useEffect(() => {
    if (!tableLayout && protocols.length > MAX_PROTOCOLS_ON_SMALL_SCREEN) {
      setOverflowState((prev) => ({
        ...prev,
        isOverflow: true,
      }));
    }
  }, [protocols, tableLayout]);

  useEffect(() => {
    const initDeFiData = async ({
      accountId,
      networkId,
    }: {
      accountId: string;
      networkId: string;
    }) => {
      void backgroundApiProxy.serviceDeFi.updateCurrentAccount({
        networkId,
        accountId,
      });
    };
    if (account?.id && network?.id) {
      void initDeFiData({
        accountId: account.id,
        networkId: network.id,
      });
    }
  }, [account?.id, network?.id]);

  useEffect(() => {
    const refresh = () => {
      if (network?.isAllNetworks) {
        void handleRefreshAllNetworkData();
      } else {
        void run();
      }
    };

    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    };
  }, [isFocused, network?.isAllNetworks, handleRefreshAllNetworkData, run]);

  useEffect(() => {
    if (allNetworksResult) {
      const tempOverview = {
        totalValue: '0',
        totalDebt: '0',
        netWorth: '0',
        chains: [] as string[],
        protocolCount: 0,
        positionCount: 0,
      };
      let tempProtocols: IDeFiProtocol[] = [];
      let tempProtocolMap: Record<string, IProtocolSummary> = {};
      // merge all networks result
      for (const r of allNetworksResult) {
        tempOverview.totalValue = new BigNumber(tempOverview.totalValue)
          .plus(r.overview.totalValue)
          .toFixed();
        tempOverview.totalDebt = new BigNumber(tempOverview.totalDebt)
          .plus(r.overview.totalDebt)
          .toFixed();
        tempOverview.netWorth = new BigNumber(tempOverview.netWorth)
          .plus(r.overview.netWorth)
          .toFixed();
        tempOverview.chains = Array.from(
          new Set([...tempOverview.chains, ...r.overview.chains]),
        );
        tempOverview.protocolCount += r.overview.protocolCount;
        tempOverview.positionCount += r.overview.positionCount;
        tempProtocols = [...tempProtocols, ...r.protocols];
        tempProtocolMap = {
          ...tempProtocolMap,
          ...r.protocolMap,
        };
      }
      updateDeFiListOverview({
        overview: tempOverview,
      });
      updateDeFiListProtocols({
        protocols: tempProtocols,
      });
      updateDeFiListProtocolMap({
        protocolMap: tempProtocolMap,
      });
      updateDeFiListState({
        initialized: true,
        isRefreshing: false,
      });
    }
  }, [
    allNetworksResult,
    updateDeFiListOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  ]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      if (network?.isAllNetworks) {
        handleRefreshAllNetworkData();
      } else {
        void run();
      }
    }
  }, [
    isHeaderRefreshing,
    run,
    handleRefreshAllNetworkData,
    network?.isAllNetworks,
  ]);

  const filteredProtocols = useMemo(() => {
    if (overflowState.isOverflow && overflowState.isSliced) {
      return protocols.slice(0, MAX_PROTOCOLS_ON_SMALL_SCREEN);
    }
    return protocols;
  }, [protocols, overflowState.isOverflow, overflowState.isSliced]);

  const renderSubTitle = useCallback(() => {
    if (tableLayout) {
      if (!initialized && isRefreshing) {
        return <Skeleton.HeadingXl />;
      }

      return (
        <NumberSizeableText
          size="$headingXl"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {overview.netWorth}
        </NumberSizeableText>
      );
    }

    return null;
  }, [
    settings.currencyInfo.symbol,
    overview.netWorth,
    initialized,
    isRefreshing,
    tableLayout,
  ]);
  const renderContent = useCallback(() => {
    return (
      <>
        <YStack gap={tableLayout ? '$5' : '$0'} flex={1}>
          {filteredProtocols.map((protocol) => (
            <Protocol
              key={`${protocol.networkId}-${protocol.protocol}`}
              protocol={protocol}
              tableLayout={tableLayout}
              isAllNetworks={network?.isAllNetworks}
            />
          ))}
        </YStack>
        {overflowState.isOverflow ? (
          <Stack
            alignItems="center"
            justifyContent="center"
            pt="$4"
            flexDirection={tableLayout ? 'row' : 'column'}
          >
            <Button
              size={tableLayout ? 'small' : 'medium'}
              variant="secondary"
              onPress={() =>
                setOverflowState((prev) => ({
                  ...prev,
                  isSliced: !prev.isSliced,
                }))
              }
            >
              {overflowState.isSliced
                ? intl.formatMessage({ id: ETranslations.global_show_more })
                : intl.formatMessage({ id: ETranslations.global_show_less })}
            </Button>
          </Stack>
        ) : null}
      </>
    );
  }, [
    filteredProtocols,
    tableLayout,
    network?.isAllNetworks,
    intl,
    overflowState.isOverflow,
    overflowState.isSliced,
  ]);

  if (protocols.length === 0) {
    return (
      <RichBlock
        withTitleSeparator
        title={intl.formatMessage({ id: ETranslations.global_earn })}
        subTitle={renderSubTitle()}
        plainContentContainer={!tableLayout}
        content={
          !initialized && isRefreshing ? (
            <ListLoading
              itemProps={
                tableLayout
                  ? undefined
                  : {
                      mx: '$0',
                      px: '$0',
                    }
              }
              isTokenSelectorView={false}
            />
          ) : (
            <EmptyDeFi tableLayout={tableLayout} />
          )
        }
      />
    );
  }

  return (
    <RichBlock
      withTitleSeparator
      title={intl.formatMessage({ id: ETranslations.global_earn })}
      subTitle={renderSubTitle()}
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { DeFiListBlock };
