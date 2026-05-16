import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { uniqBy } from 'lodash';
import { useIntl } from 'react-intl';

import type { IHomeNativeDeFiRow, IHomeNativeRow } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getProtocolValueState } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import {
  PROMISE_CONCURRENCY_LIMIT,
  promiseAllSettledEnhanced,
} from '@onekeyhq/shared/src/utils/promiseUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAccountOverviewActions } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { buildProtocolDisplayInfo } from '../../../utils/defiPositionUtils';
import { formatPortfolioTotal } from '../components/DeFiListBlock/formatPortfolioTotal';

const NATIVE_DEFI_ROW_PREFIX = 'defi:protocol:';

type INativeDeFiResponse = Awaited<
  ReturnType<typeof backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions>
>;

type INativeDeFiData = {
  overview: {
    totalValue: number;
    totalDebt: number;
    totalReward: number;
    netWorth: number;
  };
  protocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
};

type ILocalDeFiOverview = {
  totalValue: number;
  totalDebt: number;
  totalReward: number;
  netWorth: number;
  currency: string;
};

function getProtocolKey(protocol: IDeFiProtocol) {
  return defiUtils.buildProtocolMapKey({
    protocol: protocol.protocol,
    networkId: protocol.networkId,
  });
}

function getDeFiRowKey(protocol: IDeFiProtocol) {
  return `${NATIVE_DEFI_ROW_PREFIX}${getProtocolKey(protocol)}`;
}

function getProtocolKeyFromNativeRowKey(rowKey: string) {
  return rowKey.startsWith(NATIVE_DEFI_ROW_PREFIX)
    ? rowKey.slice(NATIVE_DEFI_ROW_PREFIX.length)
    : '';
}

function isDeFiResponse(
  response: INativeDeFiResponse | null,
): response is INativeDeFiResponse {
  return !!response;
}

function sortProtocols({
  protocols,
  protocolMap,
}: {
  protocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
}) {
  return protocols.slice().toSorted((a, b) => {
    const aKey = getProtocolKey(a);
    const bKey = getProtocolKey(b);
    const aValue =
      protocolMap[aKey]?.netWorth ?? getProtocolValueState(a).value;
    const bValue =
      protocolMap[bKey]?.netWorth ?? getProtocolValueState(b).value;
    return new BigNumber(bValue ?? 0).comparedTo(aValue ?? 0);
  });
}

function mergeDeFiResponses(responses: INativeDeFiResponse[]): INativeDeFiData {
  const overview = {
    totalValue: 0,
    totalDebt: 0,
    totalReward: 0,
    netWorth: 0,
  };
  const protocols: IDeFiProtocol[] = [];
  const protocolMap: Record<string, IProtocolSummary> = {};

  for (const response of responses) {
    overview.totalValue = new BigNumber(overview.totalValue)
      .plus(response.overview.totalValue ?? 0)
      .toNumber();
    overview.totalDebt = new BigNumber(overview.totalDebt)
      .plus(response.overview.totalDebt ?? 0)
      .toNumber();
    overview.totalReward = new BigNumber(overview.totalReward)
      .plus(response.overview.totalReward ?? 0)
      .toNumber();
    overview.netWorth = new BigNumber(overview.netWorth)
      .plus(response.overview.netWorth ?? 0)
      .toNumber();
    protocols.push(...response.protocols);
    Object.assign(protocolMap, response.protocolMap);
  }

  return {
    overview,
    protocols: sortProtocols({
      protocols,
      protocolMap,
    }),
    protocolMap,
  };
}

function buildNativeDeFiRow({
  protocol,
  protocolInfo,
  currencySymbol,
  hideValue,
  networkName,
  positionsLabel,
}: {
  protocol: IDeFiProtocol;
  protocolInfo?: IProtocolSummary;
  currencySymbol: string;
  hideValue: boolean;
  networkName?: string;
  positionsLabel: string;
}): IHomeNativeDeFiRow {
  const displayInfo = buildProtocolDisplayInfo({
    protocol,
    protocolInfo,
  });
  const valueState = getProtocolValueState(protocol);
  const value = valueState.hasAvailableValue
    ? formatPortfolioTotal(valueState.value, currencySymbol, hideValue)
    : '-';

  return {
    type: 'defi',
    key: getDeFiRowKey(protocol),
    protocolKey: getProtocolKey(protocol),
    title: displayInfo.protocolName,
    subtitle: `${protocol.positions.length} ${positionsLabel}`,
    iconUri: displayInfo.protocolLogo,
    networkName,
    value,
    estimatedHeight: 72,
  };
}

export function useHomeNativeDeFiRows({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const { updateAccountDeFiOverview, updateAllNetworksState } =
    useAccountOverviewActions().current;
  const [deFiData, setDeFiData] = useState<INativeDeFiData>({
    overview: {
      totalValue: 0,
      totalDebt: 0,
      totalReward: 0,
      netWorth: 0,
    },
    protocols: [],
    protocolMap: {},
  });
  const [deFiListState, setDeFiListState] = useState({
    initialized: false,
    isRefreshing: false,
  });
  const [networkNameMap, setNetworkNameMap] = useState<Record<string, string>>(
    {},
  );
  const requestIdRef = useRef(0);
  const isForceRefreshRef = useRef(false);

  const {
    activeAccount: { account, network, wallet, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const isSupported = !!(enabled && account?.id && network?.id && wallet?.id);
  const ownerKey = `${account?.id ?? ''}__${network?.id ?? ''}`;
  const sourceCurrencyInfo = currencyMap[settings.currencyInfo.id];
  const targetCurrencyInfo = currencyMap.usd;

  const getAllNetworkAccounts = useCallback(async () => {
    if (!account?.id || !network?.id) {
      return [] as IAllNetworkAccountInfo[];
    }
    const result =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId: account.id,
        networkId: network.id,
        indexedAccountId: indexedAccount?.id,
        deriveType: undefined,
        DeFiEnabledOnly: true,
        excludeTestNetwork: true,
        networksEnabledOnly: !accountUtils.isOthersAccount({
          accountId: account.id,
        }),
      });
    updateAllNetworksState({
      visibleCount: uniqBy(result.accountsInfo, 'networkId').length,
    });
    return result.accountsInfo;
  }, [account?.id, indexedAccount?.id, network?.id, updateAllNetworksState]);

  const refreshNetworkNameMap = useCallback(async () => {
    const { networks } = await backgroundApiProxy.serviceNetwork.getAllNetworks(
      {
        excludeAllNetworkItem: true,
        excludeTestNetwork: true,
      },
    );
    setNetworkNameMap(
      networks.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.name;
        return acc;
      }, {}),
    );
  }, []);

  const convertLocalOverviewCurrency = useCallback(
    (overview: ILocalDeFiOverview) => {
      if (overview.currency === settings.currencyInfo.id) {
        return overview;
      }
      const source = currencyMap[overview.currency];
      const target = currencyMap[settings.currencyInfo.id];
      if (!source || !target) {
        return overview;
      }
      return {
        ...overview,
        totalValue: new BigNumber(overview.totalValue)
          .div(source.value)
          .times(target.value)
          .toNumber(),
        totalDebt: new BigNumber(overview.totalDebt)
          .div(source.value)
          .times(target.value)
          .toNumber(),
        totalReward: new BigNumber(overview.totalReward)
          .div(source.value)
          .times(target.value)
          .toNumber(),
        netWorth: new BigNumber(overview.netWorth)
          .div(source.value)
          .times(target.value)
          .toNumber(),
        currency: settings.currencyInfo.id,
      };
    },
    [currencyMap, settings.currencyInfo.id],
  );

  const applyDeFiData = useCallback(
    (nextData: INativeDeFiData) => {
      setDeFiData(nextData);
      setDeFiListState({
        initialized: true,
        isRefreshing: false,
      });
      updateAccountDeFiOverview({
        currency: settings.currencyInfo.id,
        accountId: account?.id,
        networkId: network?.id,
        overview: nextData.overview,
        isReady: true,
      });
    },
    [
      account?.id,
      network?.id,
      settings.currencyInfo.id,
      updateAccountDeFiOverview,
    ],
  );

  const hydrateLocalDeFiOverview = useCallback(async () => {
    if (!account?.id || !network?.id) {
      return false;
    }

    await backgroundApiProxy.serviceDeFi.updateCurrentAccount({
      accountId: account.id,
      networkId: network.id,
    });

    if (network.isAllNetworks) {
      const localDeFiOverview = (
        await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
          accounts: [
            {
              accountId: account.id,
              networkId: network.id,
              indexedAccountId: indexedAccount?.id,
            },
          ],
          networksEnabledOnly: !accountUtils.isOthersAccount({
            accountId: account.id,
          }),
        })
      )[0];

      const localEntries = Object.values(localDeFiOverview?.overview ?? {});
      if (localEntries.length === 0) {
        updateAccountDeFiOverview({
          currency: settings.currencyInfo.id,
          accountId: account.id,
          networkId: network.id,
          overview: {
            totalValue: 0,
            totalDebt: 0,
            totalReward: 0,
            netWorth: 0,
          },
          isReady: false,
        });
        return false;
      }

      const overview = localEntries.map(convertLocalOverviewCurrency).reduce(
        (acc, item) => ({
          totalValue: new BigNumber(acc.totalValue)
            .plus(item.totalValue)
            .toNumber(),
          totalDebt: new BigNumber(acc.totalDebt)
            .plus(item.totalDebt)
            .toNumber(),
          totalReward: new BigNumber(acc.totalReward)
            .plus(item.totalReward)
            .toNumber(),
          netWorth: new BigNumber(acc.netWorth).plus(item.netWorth).toNumber(),
        }),
        {
          totalValue: 0,
          totalDebt: 0,
          totalReward: 0,
          netWorth: 0,
        },
      );
      updateAccountDeFiOverview({
        currency: settings.currencyInfo.id,
        accountId: account.id,
        networkId: network.id,
        overview,
        isReady: true,
      });
      return true;
    }

    const localDeFiOverview = (
      await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
        accounts: [
          {
            accountId: account.id,
            networkId: network.id,
            accountAddress: account.address,
          },
        ],
      })
    )[0];
    const rawOverview = localDeFiOverview?.overview?.[network.id];
    if (!rawOverview) {
      updateAccountDeFiOverview({
        currency: settings.currencyInfo.id,
        accountId: account.id,
        networkId: network.id,
        overview: {
          totalValue: 0,
          totalDebt: 0,
          totalReward: 0,
          netWorth: 0,
        },
        isReady: false,
      });
      return false;
    }
    const convertedOverview = convertLocalOverviewCurrency(rawOverview);
    updateAccountDeFiOverview({
      currency: settings.currencyInfo.id,
      accountId: account.id,
      networkId: network.id,
      overview: convertedOverview,
      isReady: true,
    });
    return true;
  }, [
    account?.address,
    account?.id,
    convertLocalOverviewCurrency,
    indexedAccount?.id,
    network?.id,
    network?.isAllNetworks,
    settings.currencyInfo.id,
    updateAccountDeFiOverview,
  ]);

  const fetchAllNetworkDeFi = useCallback(async () => {
    if (!account?.id || !network?.id) {
      return undefined;
    }
    const allNetworkAccounts = await getAllNetworkAccounts();
    const responses = (
      await promiseAllSettledEnhanced(
        allNetworkAccounts.map((networkAccount) => async () => {
          return backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
            accountId: networkAccount.accountId,
            networkId: networkAccount.networkId,
            accountAddress: networkAccount.apiAddress,
            xpub: networkAccount.accountXpub,
            isAllNetworks: true,
            allNetworksAccountId: account.id,
            allNetworksNetworkId: network.id,
            saveToLocal: true,
            excludeLowValueProtocols: true,
            sourceCurrencyInfo,
            targetCurrencyInfo,
            isForceRefresh: isForceRefreshRef.current,
          });
        }),
        {
          continueOnError: true,
          concurrency: PROMISE_CONCURRENCY_LIMIT,
        },
      )
    ).filter(isDeFiResponse);

    return mergeDeFiResponses(responses);
  }, [
    account?.id,
    getAllNetworkAccounts,
    network?.id,
    sourceCurrencyInfo,
    targetCurrencyInfo,
  ]);

  const refreshNativeDeFi = useCallback(async () => {
    if (!isSupported || !account?.id || !network?.id) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setDeFiListState((prev) => ({
      initialized: prev.initialized,
      isRefreshing: true,
    }));
    appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
      isRefreshing: true,
      type: EHomeTab.DEFI,
      accountId: account.id,
      networkId: network.id,
    });

    try {
      await backgroundApiProxy.serviceDeFi.abortFetchAccountDeFiPositions();
      await backgroundApiProxy.serviceDeFi.updateCurrentAccount({
        accountId: account.id,
        networkId: network.id,
      });

      let nextData: INativeDeFiData | undefined;
      if (network.isAllNetworks) {
        nextData = await fetchAllNetworkDeFi();
      } else {
        const response =
          await backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
            accountId: account.id,
            networkId: network.id,
            accountAddress: account.address,
            excludeLowValueProtocols: true,
            sourceCurrencyInfo,
            targetCurrencyInfo,
            saveToLocal: true,
            isForceRefresh: isForceRefreshRef.current,
          });
        nextData = mergeDeFiResponses([response]);
      }

      if (requestIdRef.current !== requestId || !nextData) {
        return;
      }

      applyDeFiData(nextData);
    } catch (error) {
      console.error(error);
      setDeFiListState({
        initialized: true,
        isRefreshing: false,
      });
    } finally {
      isForceRefreshRef.current = false;
      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: false,
        type: EHomeTab.DEFI,
        accountId: account.id,
        networkId: network.id,
      });
    }
  }, [
    account?.address,
    account?.id,
    applyDeFiData,
    fetchAllNetworkDeFi,
    isSupported,
    network?.id,
    network?.isAllNetworks,
    sourceCurrencyInfo,
    targetCurrencyInfo,
  ]);

  useEffect(() => {
    void refreshNetworkNameMap();
  }, [refreshNetworkNameMap]);

  useEffect(() => {
    let cancelled = false;

    if (!isSupported) {
      setDeFiData({
        overview: {
          totalValue: 0,
          totalDebt: 0,
          totalReward: 0,
          netWorth: 0,
        },
        protocols: [],
        protocolMap: {},
      });
      setDeFiListState({
        initialized: true,
        isRefreshing: false,
      });
      return undefined;
    }

    const initDeFi = async () => {
      setDeFiListState({
        initialized: false,
        isRefreshing: true,
      });
      try {
        await hydrateLocalDeFiOverview();
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          void refreshNativeDeFi();
        }
      }
    };

    void initDeFi();

    return () => {
      cancelled = true;
    };
  }, [hydrateLocalDeFiOverview, isSupported, ownerKey, refreshNativeDeFi]);

  useEffect(() => {
    const refresh = () => {
      isForceRefreshRef.current = true;
      void refreshNativeDeFi();
    };
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, refresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    appEventBus.on(EAppEventBusNames.DeFiPositionRefreshed, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
      appEventBus.off(EAppEventBusNames.GlobalDeriveTypeUpdate, refresh);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
      appEventBus.off(EAppEventBusNames.DeFiPositionRefreshed, refresh);
    };
  }, [refreshNativeDeFi]);

  const deFiRows = useMemo<IHomeNativeRow[]>(() => {
    const titleRow: IHomeNativeRow = {
      type: 'sectionHeader',
      key: 'defi:title',
      title: intl.formatMessage({
        id: ETranslations.global_earn,
      }),
    };

    if (!isSupported) {
      return [
        titleRow,
        {
          type: 'empty',
          key: 'defi:no-wallet',
          title: intl.formatMessage({ id: ETranslations.global_no_wallet }),
          estimatedHeight: 88,
        },
      ];
    }

    if (deFiListState.isRefreshing && deFiData.protocols.length === 0) {
      return [
        titleRow,
        {
          type: 'loading',
          key: 'defi:loading',
          rows: 6,
          estimatedHeight: 72,
        },
      ];
    }

    if (deFiListState.initialized && deFiData.protocols.length === 0) {
      return [
        titleRow,
        {
          type: 'empty',
          key: 'defi:empty',
          title: intl.formatMessage({ id: ETranslations.global_no_data }),
          estimatedHeight: 88,
        },
      ];
    }

    const positionsLabel = intl.formatMessage({
      id: ETranslations.earn_positions,
    });
    return [
      titleRow,
      ...deFiData.protocols.map((protocol) => {
        const protocolKey = getProtocolKey(protocol);
        return buildNativeDeFiRow({
          protocol,
          protocolInfo: deFiData.protocolMap[protocolKey],
          currencySymbol: settings.currencyInfo.symbol,
          hideValue: settingsValue.hideValue,
          networkName: networkNameMap[protocol.networkId],
          positionsLabel,
        });
      }),
    ];
  }, [
    deFiData.protocolMap,
    deFiData.protocols,
    deFiListState.initialized,
    deFiListState.isRefreshing,
    intl,
    isSupported,
    networkNameMap,
    settings.currencyInfo.symbol,
    settingsValue.hideValue,
  ]);

  const protocolByKey = useMemo(() => {
    const result: Record<
      string,
      {
        protocol: IDeFiProtocol;
        protocolInfo?: IProtocolSummary;
      }
    > = {};
    for (const protocol of deFiData.protocols) {
      const protocolKey = getProtocolKey(protocol);
      result[protocolKey] = {
        protocol,
        protocolInfo: deFiData.protocolMap[protocolKey],
      };
    }
    return result;
  }, [deFiData.protocolMap, deFiData.protocols]);

  const handleDeFiRowPress = useCallback(
    (rowKey: string) => {
      const protocolKey = getProtocolKeyFromNativeRowKey(rowKey);
      const item = protocolByKey[protocolKey];
      if (!item) {
        return;
      }
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.DeFiProtocolDetails,
        params: item,
      });
    },
    [navigation, protocolByKey],
  );

  const refreshNativeDeFiManually = useCallback(async () => {
    isForceRefreshRef.current = true;
    await refreshNativeDeFi();
  }, [refreshNativeDeFi]);

  return {
    deFiRows,
    handleDeFiRowPress,
    isRefreshing: deFiListState.isRefreshing,
    refreshNativeDeFi: refreshNativeDeFiManually,
  };
}
