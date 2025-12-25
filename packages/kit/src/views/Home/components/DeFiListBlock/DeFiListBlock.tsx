import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import {
  Button,
  Skeleton,
  XStack,
  YStack,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EmptyDeFi } from '@onekeyhq/kit/src/components/Empty';
import { ListLoading } from '@onekeyhq/kit/src/components/Loading';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { useAllNetworkRequests } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountDeFiOverviewAtom,
  useAccountOverviewActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useDeFiListActions,
  useDeFiListProtocolsAtom,
  useDeFiListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import type { IDeFiDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityDeFi';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  const [{ currencyMap }] = useCurrencyPersistAtom();

  const sourceCurrencyInfo = useMemo(
    () => currencyMap[settings.currencyInfo.id],
    [settings.currencyInfo.id, currencyMap],
  );
  const targetCurrencyInfo = useMemo(() => currencyMap.usd, [currencyMap]);

  const {
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  } = useDeFiListActions().current;

  const { updateAccountDeFiOverview } = useAccountOverviewActions().current;

  const { isFocused, isHeaderRefreshing } = useTabIsRefreshingFocused();

  const [overview] = useAccountDeFiOverviewAtom();
  const [{ isRefreshing, initialized }] = useDeFiListStateAtom();
  const [{ protocols }] = useDeFiListProtocolsAtom();

  const deFiRawDataRef = useRef<IDeFiDBStruct | undefined>(undefined);

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

  const [isDeFiEnabled, setIsDeFiEnabled] = useState(false);

  const checkDeFiEnabled = useCallback(async () => {
    if (!network?.id) {
      return;
    }

    if (networkUtils.isAllNetwork({ networkId: network.id })) {
      setIsDeFiEnabled(true);
      return;
    }

    const enabledNetworks =
      await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap();
    setIsDeFiEnabled(!!enabledNetworks[network.id]);
  }, [network?.id]);

  useEffect(() => {
    void checkDeFiEnabled();
  }, [checkDeFiEnabled]);

  const { run } = usePromiseResult(
    async () => {
      if (!account || !network) {
        return;
      }

      if (networkUtils.isAllNetwork({ networkId: network.id })) {
        return;
      }

      const enabledNetworks =
        await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap();

      if (!enabledNetworks[network.id]) {
        const emptyData = defiUtils.getEmptyDeFiData();
        updateAccountDeFiOverview({
          overview: emptyData.overview,
          currency: settings.currencyInfo.id,
        });
        updateDeFiListProtocols({
          protocols: emptyData.protocols,
        });
        updateDeFiListProtocolMap({
          protocolMap: emptyData.protocolMap,
        });
        updateDeFiListState({
          initialized: true,
          isRefreshing: false,
        });
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
            sourceCurrencyInfo,
            targetCurrencyInfo,
            saveToLocal: true,
          });
        updateAccountDeFiOverview({
          currency: settings.currencyInfo.id,
          overview: {
            totalValue: resp.overview.totalValue ?? 0,
            totalDebt: resp.overview.totalDebt ?? 0,
            totalReward: resp.overview.totalReward ?? 0,
            netWorth: resp.overview.netWorth ?? 0,
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
      settings.currencyInfo.id,
      updateAccountDeFiOverview,
      updateDeFiListProtocols,
      updateDeFiListProtocolMap,
      updateDeFiListState,
      sourceCurrencyInfo,
      targetCurrencyInfo,
    ],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_DEFI,
    },
  );

  const deFiDataRef = useRef<{
    overview: {
      totalValue: number;
      totalDebt: number;
      totalReward: number;
      netWorth: number;
      chains: string[];
      protocolCount: number;
      positionCount: number;
    };
    protocols: IDeFiProtocol[];
  }>(defiUtils.getEmptyDeFiData());

  const updateAllNetworkData = useThrottledCallback(() => {
    updateAccountDeFiOverview({
      currency: settings.currencyInfo.id,
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
        sourceCurrencyInfo,
        targetCurrencyInfo,
      });

      if (!allNetworkDataInit && r.isSameAllNetworksAccountData) {
        deFiDataRef.current = {
          overview: {
            totalValue: new BigNumber(r.overview.totalValue ?? 0)
              .plus(deFiDataRef.current.overview.totalValue)
              .toNumber(),
            totalDebt: new BigNumber(r.overview.totalDebt ?? 0)
              .plus(deFiDataRef.current.overview.totalDebt)
              .toNumber(),
            totalReward: new BigNumber(r.overview.totalReward ?? 0)
              .plus(deFiDataRef.current.overview.totalReward)
              .toNumber(),
            netWorth: new BigNumber(r.overview.netWorth ?? 0)
              .plus(deFiDataRef.current.overview.netWorth)
              .toNumber(),
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
      sourceCurrencyInfo,
      targetCurrencyInfo,
    ],
  );

  const handleClearAllNetworkData = useCallback(() => {
    updateAccountDeFiOverview({
      currency: settings.currencyInfo.id,
      overview: {
        totalValue: 0,
        totalDebt: 0,
        totalReward: 0,
        netWorth: 0,
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
    settings.currencyInfo.id,
    updateAccountDeFiOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
  ]);

  const handleAllNetworkRequestsStarted = useCallback(async () => {
    deFiRawDataRef.current =
      (await backgroundApiProxy.simpleDb.deFi.getRawData()) ?? undefined;
  }, []);

  const handleAllNetworkCacheRequests = useCallback(
    async ({
      accountId,
      networkId,
      accountAddress,
      xpub,
    }: {
      accountId: string;
      networkId: string;
      accountAddress: string;
      xpub?: string;
    }) => {
      const localDeFiOverview =
        await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
          accounts: [
            {
              accountId,
              networkId,
              accountAddress,
              xpub,
            },
          ],
          deFiRawData: deFiRawDataRef.current,
        });

      const currentNetworkDeFiOverview =
        localDeFiOverview?.[0]?.overview?.[networkId];

      if (currentNetworkDeFiOverview) {
        if (currentNetworkDeFiOverview.currency !== settings.currencyInfo.id) {
          const _sourceCurrencyInfo =
            currencyMap[currentNetworkDeFiOverview.currency];
          const _targetCurrencyInfo = currencyMap[settings.currencyInfo.id];
          currentNetworkDeFiOverview.totalValue = new BigNumber(
            currentNetworkDeFiOverview.totalValue,
          )
            .div(_sourceCurrencyInfo.value)
            .times(_targetCurrencyInfo.value)
            .toNumber();
          currentNetworkDeFiOverview.totalDebt = new BigNumber(
            currentNetworkDeFiOverview.totalDebt,
          )
            .div(_sourceCurrencyInfo.value)
            .times(_targetCurrencyInfo.value)
            .toNumber();
          currentNetworkDeFiOverview.totalReward = new BigNumber(
            currentNetworkDeFiOverview.totalReward,
          )
            .div(_sourceCurrencyInfo.value)
            .times(_targetCurrencyInfo.value)
            .toNumber();
          currentNetworkDeFiOverview.netWorth = new BigNumber(
            currentNetworkDeFiOverview.netWorth,
          )
            .div(_sourceCurrencyInfo.value)
            .times(_targetCurrencyInfo.value)
            .toNumber();
        }
      }

      return {
        overview: currentNetworkDeFiOverview,
      };
    },
    [currencyMap, settings.currencyInfo.id],
  );

  const handleAllNetworkCacheData = useCallback(
    async ({
      data,
    }: {
      data: {
        overview: {
          totalValue: number;
          totalDebt: number;
          totalReward: number;
          netWorth: number;
          currency: string;
        };
      }[];
    }) => {
      const tempOverview: {
        totalValue: number;
        totalDebt: number;
        totalReward: number;
        netWorth: number;
      } = {
        totalValue: 0,
        totalDebt: 0,
        totalReward: 0,
        netWorth: 0,
      };
      for (const d of data) {
        tempOverview.totalValue += d.overview.totalValue;
        tempOverview.totalDebt += d.overview.totalDebt;
        tempOverview.totalReward += d.overview.totalReward;
        tempOverview.netWorth += d.overview.netWorth;
      }
      updateAccountDeFiOverview({
        currency: settings.currencyInfo.id,
        overview: tempOverview,
      });
    },
    [settings.currencyInfo.id, updateAccountDeFiOverview],
  );

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
    onStarted: handleAllNetworkRequestsStarted,
    allNetworkCacheRequests: handleAllNetworkCacheRequests,
    allNetworkCacheData: handleAllNetworkCacheData,
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
      updateAccountDeFiOverview({
        currency: settings.currencyInfo.id,
        overview: {
          totalValue: 0,
          totalDebt: 0,
          netWorth: 0,
          totalReward: 0,
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
    updateAccountDeFiOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    settings.currencyInfo.id,
  ]);

  useEffect(() => {
    if (!tableLayout) {
      setOverflowState((prev) => ({
        ...prev,
        isOverflow: protocols.length > MAX_PROTOCOLS_ON_SMALL_SCREEN,
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

      if (networkUtils.isAllNetwork({ networkId })) {
        return;
      }

      const localDeFiOverview = (
        await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
          accounts: [
            {
              accountId,
              networkId,
              accountAddress: account?.address,
            },
          ],
        })
      )[0];

      if (localDeFiOverview) {
        const currentNetworkDeFiOverview =
          localDeFiOverview.overview[networkId];
        if (currentNetworkDeFiOverview) {
          if (
            currentNetworkDeFiOverview.currency !== settings.currencyInfo.id
          ) {
            const _sourceCurrencyInfo =
              currencyMap[currentNetworkDeFiOverview.currency];
            const _targetCurrencyInfo = currencyMap[settings.currencyInfo.id];
            currentNetworkDeFiOverview.totalValue = new BigNumber(
              currentNetworkDeFiOverview.totalValue,
            )
              .div(_sourceCurrencyInfo.value)
              .times(_targetCurrencyInfo.value)
              .toNumber();
            currentNetworkDeFiOverview.totalDebt = new BigNumber(
              currentNetworkDeFiOverview.totalDebt,
            )
              .div(_sourceCurrencyInfo.value)
              .times(_targetCurrencyInfo.value)
              .toNumber();
            currentNetworkDeFiOverview.totalReward = new BigNumber(
              currentNetworkDeFiOverview.totalReward,
            )
              .div(_sourceCurrencyInfo.value)
              .times(_targetCurrencyInfo.value)
              .toNumber();
            currentNetworkDeFiOverview.netWorth = new BigNumber(
              currentNetworkDeFiOverview.netWorth,
            )
              .div(_sourceCurrencyInfo.value)
              .times(_targetCurrencyInfo.value)
              .toNumber();
          }
          updateAccountDeFiOverview({
            currency: settings.currencyInfo.id,
            overview: currentNetworkDeFiOverview,
          });
        }
      }
    };
    if (account?.id && network?.id) {
      void initDeFiData({
        accountId: account.id,
        networkId: network.id,
      });
    }
  }, [
    account?.id,
    network?.id,
    account?.address,
    updateAccountDeFiOverview,
    settings.currencyInfo.id,
    currencyMap,
  ]);

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
        totalValue: 0,
        totalDebt: 0,
        totalReward: 0,
        netWorth: 0,
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
          .toNumber();
        tempOverview.totalDebt = new BigNumber(tempOverview.totalDebt)
          .plus(r.overview.totalDebt)
          .toNumber();
        tempOverview.netWorth = new BigNumber(tempOverview.netWorth)
          .plus(r.overview.netWorth)
          .toNumber();
        tempOverview.totalReward = new BigNumber(tempOverview.totalReward)
          .plus(r.overview.totalReward)
          .toNumber();
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
      updateAccountDeFiOverview({
        currency: settings.currencyInfo.id,
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
    updateAccountDeFiOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
    settings.currencyInfo.id,
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
        <NumberSizeableTextWrapper
          hideValue
          size="$headingXl"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {overview.netWorth}
        </NumberSizeableTextWrapper>
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
          <XStack alignItems="center" justifyContent="center" pt="$4">
            <Button
              size="small"
              variant="secondary"
              onPress={() =>
                setOverflowState((prev) => ({
                  ...prev,
                  isSliced: !prev.isSliced,
                }))
              }
              $md={
                {
                  flexGrow: 1,
                  flexBasis: 0,
                  size: 'medium',
                  borderRadius: '$full',
                } as any
              }
            >
              {overflowState.isSliced
                ? intl.formatMessage({ id: ETranslations.global_show_more })
                : intl.formatMessage({ id: ETranslations.global_show_less })}
            </Button>
          </XStack>
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

  if (!isDeFiEnabled) {
    return null;
  }

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
