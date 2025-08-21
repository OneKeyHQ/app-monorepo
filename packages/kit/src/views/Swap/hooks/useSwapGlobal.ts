import { useCallback, useEffect, useRef, useState } from 'react';

import { isNil } from 'lodash';

import { useIsModalPage } from '@onekeyhq/components';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISwapProviderManager } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapInitParams,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapMevConfigAtom,
  useSwapNativeTokenReserveGasAtom,
  useSwapNetworksAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTipsAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';

export function useSwapInit(params?: ISwapInitParams) {
  const [swapNetworks, setSwapNetworks] = useSwapNetworksAtom();
  const [fromToken, setFromToken] = useSwapSelectFromTokenAtom();
  const [toToken, setToToken] = useSwapSelectToTokenAtom();
  const [, setSwapMevConfig] = useSwapMevConfigAtom();
  const { syncNetworksSort, needChangeToken } = useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const [networkListFetching, setNetworkListFetching] = useState<boolean>(true);
  const [skipSyncDefaultSelectedToken, setSkipSyncDefaultSelectedToken] =
    useState<boolean>(false);
  const swapAddressInfoRef =
    useRef<ReturnType<typeof useSwapAddressInfo>>(undefined);
  const [, setInAppNotification] = useInAppNotificationAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapNativeTokenReserveGas] = useSwapNativeTokenReserveGasAtom();
  const [, setSwapTips] = useSwapTipsAtom();
  const { swapTypeSwitchAction } = useSwapActions().current;
  if (swapAddressInfoRef.current !== swapAddressInfo) {
    swapAddressInfoRef.current = swapAddressInfo;
  }
  const swapNetworksRef = useRef<ISwapNetwork[]>([]);
  if (swapNetworksRef.current !== swapNetworks) {
    swapNetworksRef.current = swapNetworks;
  }
  const fromTokenRef = useRef<ISwapToken>(undefined);
  if (fromTokenRef.current !== fromToken) {
    fromTokenRef.current = fromToken;
  }
  const toTokenRef = useRef<ISwapToken>(undefined);
  if (toTokenRef.current !== toToken) {
    toTokenRef.current = toToken;
  }
  const fromTokenAmountRef = useRef<{ value: string; isInput: boolean }>(
    fromTokenAmount,
  );
  if (fromTokenAmountRef.current?.value !== fromTokenAmount?.value) {
    fromTokenAmountRef.current = fromTokenAmount;
  }

  const fetchSwapNetworks = useCallback(async () => {
    if (swapNetworks.length) {
      setNetworkListFetching(false);
      return;
    }
    let swapNetworksSortList =
      await backgroundApiProxy.simpleDb.swapNetworksSort.getRawData();
    if (swapNetworksSortList?.data?.length) {
      const noSupportInfo = swapNetworksSortList?.data.every(
        (net) =>
          (isNil(net.supportCrossChainSwap) && isNil(net.supportSingleSwap)) ||
          isNil(net.supportLimit),
      );
      if (!noSupportInfo) {
        setSwapNetworks(swapNetworksSortList.data);
        setNetworkListFetching(false);
      } else {
        swapNetworksSortList = null;
        void backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
          data: [],
        });
      }
    }
    let networks: ISwapNetwork[] = [];
    const fetchNetworks =
      await backgroundApiProxy.serviceSwap.fetchSwapNetworks();
    networks = [...fetchNetworks];
    if (swapNetworksSortList?.data?.length && fetchNetworks?.length) {
      const sortNetworks = swapNetworksSortList.data;
      networks = sortNetworks
        .filter((network) =>
          fetchNetworks.find((n) => n.networkId === network.networkId),
        )
        .map((net) => {
          const serverNetwork = fetchNetworks.find(
            (n) => n.networkId === net.networkId,
          );
          return { ...net, ...serverNetwork };
        })
        .concat(
          fetchNetworks.filter(
            (network) =>
              !sortNetworks.find((n) => n.networkId === network.networkId),
          ),
        );
    }
    if (networks.length) {
      await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
        data: networks,
      });
      if (
        !swapNetworksSortList?.data?.length ||
        swapNetworksSortList?.data?.length !== networks.length
      ) {
        setSwapNetworks(networks);
        setNetworkListFetching(false);
      }
    }
  }, [setSwapNetworks, swapNetworks.length]);

  const fetchSyncSwapProviderManager = useCallback(
    async (noFetch?: boolean) => {
      const swapProviderManagerSimpleDb =
        await backgroundApiProxy.simpleDb.swapConfigs.getSwapProviderManager();
      const bridgeProviderManagerSimpleDb =
        await backgroundApiProxy.simpleDb.swapConfigs.getBridgeProviderManager();
      setInAppNotification((pre) => ({
        ...pre,
        swapProviderManager: swapProviderManagerSimpleDb,
        bridgeProviderManager: bridgeProviderManagerSimpleDb,
      }));
      if (noFetch) {
        return;
      }
      const swapProviderManagerFromServer =
        await backgroundApiProxy.serviceSwap.getSwapProviderManager();

      if (swapProviderManagerFromServer.length) {
        const supportSingleSwap = swapProviderManagerFromServer.filter(
          (provider) => provider.isSupportSingleSwap,
        );
        const supportCrossChainSwap = swapProviderManagerFromServer.filter(
          (provider) => provider.isSupportCrossChain,
        );
        // swapProviderManager
        if (!swapProviderManagerSimpleDb.length) {
          const syncSingleSwapProviderData = supportSingleSwap.map(
            (provider) => {
              const providerInfo = provider.providerInfo;
              const enable = true;
              const providerInitData: ISwapProviderManager = {
                providerInfo,
                enable,
                serviceDisable: provider.providerServiceDisable,
                supportNetworks: provider.supportSingleSwapNetworks,
                disableNetworks: [],
                serviceDisableNetworks: provider.serviceDisableNetworks,
              };
              return providerInitData;
            },
          );
          await backgroundApiProxy.simpleDb.swapConfigs.setSwapProviderManager(
            syncSingleSwapProviderData,
          );
        } else {
          const findNewProvider = supportSingleSwap.filter(
            (provider) =>
              !swapProviderManagerSimpleDb.find(
                (p) =>
                  p.providerInfo.provider === provider.providerInfo.provider,
              ),
          );
          if (findNewProvider.length) {
            const syncNewSingleSwapProviderData = findNewProvider.map(
              (provider) => {
                const providerInfo = provider.providerInfo;
                const enable = true;
                const providerInitData: ISwapProviderManager = {
                  providerInfo,
                  enable,
                  serviceDisable: provider.providerServiceDisable,
                  supportNetworks: provider.supportSingleSwapNetworks,
                  disableNetworks: [],
                  serviceDisableNetworks: provider.serviceDisableNetworks,
                };
                return providerInitData;
              },
            );
            await backgroundApiProxy.simpleDb.swapConfigs.setSwapProviderManager(
              [
                ...swapProviderManagerSimpleDb,
                ...syncNewSingleSwapProviderData,
              ],
            );
          }
          const findNoProvider = swapProviderManagerSimpleDb.filter(
            (provider) =>
              !swapProviderManagerFromServer.find(
                (p) =>
                  p.providerInfo.provider === provider.providerInfo.provider,
              ),
          );
          if (findNoProvider.length) {
            const simpleDbSwapProviderManager =
              await backgroundApiProxy.simpleDb.swapConfigs.getSwapProviderManager();
            const syncNoProviderData = simpleDbSwapProviderManager.filter(
              (provider) =>
                !findNoProvider.find(
                  (p) =>
                    p.providerInfo.provider === provider.providerInfo.provider,
                ),
            );
            await backgroundApiProxy.simpleDb.swapConfigs.setSwapProviderManager(
              syncNoProviderData,
            );
          }
          // update serviceDisable
          const simpleDbCurrentSwapProviderManager =
            await backgroundApiProxy.simpleDb.swapConfigs.getSwapProviderManager();
          const syncServiceDisable = simpleDbCurrentSwapProviderManager.map(
            (provider) => {
              const findProvider = swapProviderManagerFromServer.find(
                (p) =>
                  p.providerInfo.provider === provider.providerInfo.provider,
              );
              let serviceDisable;
              let serviceDisableNetworks;
              if (findProvider) {
                serviceDisable = findProvider.providerServiceDisable;
                serviceDisableNetworks = findProvider.serviceDisableNetworks;
              }
              let supportNetworks = provider.supportNetworks;
              let disableNetworks = provider.disableNetworks;
              if (
                findProvider?.supportSingleSwapNetworks &&
                findProvider.isSupportSingleSwap
              ) {
                supportNetworks = findProvider?.supportSingleSwapNetworks;
                disableNetworks = provider.disableNetworks?.filter((net) =>
                  findProvider?.supportSingleSwapNetworks?.includes(net),
                );
              }
              return {
                ...provider,
                serviceDisable,
                serviceDisableNetworks,
                supportNetworks,
                disableNetworks,
              };
            },
          );
          await backgroundApiProxy.simpleDb.swapConfigs.setSwapProviderManager(
            syncServiceDisable,
          );
        }
        // bridgeProviderManager
        if (!bridgeProviderManagerSimpleDb) {
          const syncBridgeProviderManagerData = supportCrossChainSwap.map(
            (provider) => {
              const providerInfo = provider.providerInfo;
              const enable = true;
              return {
                providerInfo,
                enable,
                serviceDisable: provider.providerServiceDisable,
              };
            },
          );
          await backgroundApiProxy.simpleDb.swapConfigs.setBridgeProviderManager(
            syncBridgeProviderManagerData,
          );
        } else {
          const findNewBridgeProvider = supportCrossChainSwap.filter(
            (provider) =>
              !bridgeProviderManagerSimpleDb.find(
                (p) =>
                  p.providerInfo.provider === provider.providerInfo.provider,
              ),
          );
          if (findNewBridgeProvider.length) {
            const syncNewBridgeProviderData = findNewBridgeProvider.map(
              (provider) => {
                const providerInfo = provider.providerInfo;
                const enable = true;
                return {
                  providerInfo,
                  enable,
                  serviceDisable: provider.providerServiceDisable,
                };
              },
            );
            await backgroundApiProxy.simpleDb.swapConfigs.setBridgeProviderManager(
              [...bridgeProviderManagerSimpleDb, ...syncNewBridgeProviderData],
            );
          }
          const findNoBridgeProvider = bridgeProviderManagerSimpleDb.filter(
            (provider) =>
              !swapProviderManagerFromServer.find(
                (p) =>
                  p.providerInfo.provider === provider.providerInfo.provider,
              ),
          );
          if (findNoBridgeProvider.length) {
            const simpleDbBridgeProviderManager =
              await backgroundApiProxy.simpleDb.swapConfigs.getBridgeProviderManager();
            const syncNoBridgeProviderData =
              simpleDbBridgeProviderManager.filter(
                (provider) =>
                  !findNoBridgeProvider.find(
                    (p) =>
                      p.providerInfo.provider ===
                      provider.providerInfo.provider,
                  ),
              );
            await backgroundApiProxy.simpleDb.swapConfigs.setBridgeProviderManager(
              syncNoBridgeProviderData,
            );
          }
          // update serviceDisable
          const simpleDbCurrentBridgeProviderManager =
            await backgroundApiProxy.simpleDb.swapConfigs.getBridgeProviderManager();
          const syncServiceDisable = simpleDbCurrentBridgeProviderManager.map(
            (provider) => {
              const findProvider = swapProviderManagerFromServer.find(
                (p) =>
                  p.providerInfo.provider === provider.providerInfo.provider,
              );
              if (findProvider) {
                return {
                  ...provider,
                  serviceDisable: findProvider.providerServiceDisable,
                };
              }
              return provider;
            },
          );
          await backgroundApiProxy.simpleDb.swapConfigs.setBridgeProviderManager(
            syncServiceDisable,
          );
        }
        void fetchSyncSwapProviderManager(true);
      }
    },
    [setInAppNotification],
  );

  const checkSupportTokenSwapType = useCallback(
    (token: ISwapToken, enableSwitchAction?: boolean) => {
      const supportNet = swapNetworks.find(
        (net) => net.networkId === token.networkId,
      );
      let supportTypes: ESwapTabSwitchType[] = [];
      if (supportNet) {
        if (supportNet.supportSingleSwap) {
          supportTypes = [...supportTypes, ESwapTabSwitchType.SWAP];
        }
        if (supportNet.supportCrossChainSwap) {
          supportTypes = [...supportTypes, ESwapTabSwitchType.BRIDGE];
        }
        if (supportNet.supportLimit) {
          supportTypes = [...supportTypes, ESwapTabSwitchType.LIMIT];
        }
      }
      if (!params?.swapTabSwitchType && enableSwitchAction) {
        if (supportTypes.length > 0 && !supportTypes.includes(swapTypeSwitch)) {
          const needSwitchType = supportTypes.find((t) => t !== swapTypeSwitch);
          if (needSwitchType) {
            void swapTypeSwitchAction(
              needSwitchType,
              swapAddressInfoRef.current?.networkId ??
                fromTokenRef.current?.networkId,
            );
          }
        }
      }
      return supportTypes;
    },
    [
      params?.swapTabSwitchType,
      swapNetworks,
      swapTypeSwitch,
      swapTypeSwitchAction,
    ],
  );

  const syncDefaultSelectedToken = useCallback(async () => {
    if (!!fromTokenRef.current || !!toTokenRef.current) {
      return;
    }
    if (
      (params?.importFromToken &&
        swapNetworksRef.current.find(
          (net) => net.networkId === params?.importFromToken?.networkId,
        )) ||
      (params?.importToToken &&
        swapNetworksRef.current.find(
          (net) => net.networkId === params?.importToToken?.networkId,
        ))
    ) {
      if (params?.importFromToken) {
        const fromTokenSupportTypes = checkSupportTokenSwapType(
          params?.importFromToken,
        );
        if (
          params?.swapTabSwitchType &&
          fromTokenSupportTypes.includes(params?.swapTabSwitchType)
        ) {
          setFromToken(params?.importFromToken);
        }
      }
      if (params?.importToToken) {
        const toTokenSupportTypes = checkSupportTokenSwapType(
          params?.importToToken,
        );
        if (
          params?.swapTabSwitchType &&
          toTokenSupportTypes.includes(params?.swapTabSwitchType)
        ) {
          setToToken(params?.importToToken);
        }
      }
      if (params?.importFromToken && !params?.importToToken) {
        const needSetToToken = needChangeToken({
          token: params.importFromToken,
          swapTypeSwitchValue:
            params?.swapTabSwitchType ?? ESwapTabSwitchType.SWAP,
        });
        if (needSetToToken) {
          const defaultTokenSupportTypes =
            checkSupportTokenSwapType(needSetToToken);
          if (
            params?.swapTabSwitchType &&
            defaultTokenSupportTypes.includes(params?.swapTabSwitchType)
          ) {
            setToToken(needSetToToken);
          }
        }
      }
      void syncNetworksSort(
        params?.importFromToken?.networkId ??
          params?.importToToken?.networkId ??
          getNetworkIdsMap().onekeyall,
      );
      return;
    }
    if (
      !swapAddressInfoRef.current?.accountInfo?.ready ||
      !swapAddressInfoRef.current?.networkId ||
      !swapNetworksRef.current.length ||
      (params?.importNetworkId &&
        swapAddressInfoRef.current?.networkId &&
        params?.importNetworkId !== swapAddressInfoRef.current?.networkId) ||
      skipSyncDefaultSelectedToken
    ) {
      return;
    }
    const isAllNet = networkUtils.isAllNetwork({
      networkId: swapAddressInfoRef.current?.networkId,
    });
    const accountNetwork = swapNetworksRef.current.find(
      (net) => net.networkId === swapAddressInfoRef.current?.networkId,
    );
    let netInfo = accountNetwork;
    let netId = accountNetwork?.networkId;
    if (isAllNet) {
      netId = getNetworkIdsMap().onekeyall;
      const allNetDefaultToken = swapDefaultSetTokens[netId]?.fromToken;
      netInfo = swapNetworksRef.current.find(
        (net) => net.networkId === allNetDefaultToken?.networkId,
      );
    }

    if (netInfo && netId) {
      if (
        !isNil(swapDefaultSetTokens[netId]?.fromToken) ||
        !isNil(swapDefaultSetTokens[netId]?.toToken)
      ) {
        const defaultFromToken = swapDefaultSetTokens[netId]?.fromToken;
        const defaultToToken = swapDefaultSetTokens[netId]?.toToken;
        if (defaultFromToken) {
          setFromToken({
            ...defaultFromToken,
            networkLogoURI: isAllNet
              ? defaultFromToken.networkLogoURI
              : netInfo?.logoURI,
          });
          void syncNetworksSort(defaultFromToken.networkId);
        }
        if (defaultToToken) {
          setToToken({
            ...defaultToToken,
            networkLogoURI: isAllNet
              ? defaultToToken.networkLogoURI
              : netInfo?.logoURI,
          });
          void syncNetworksSort(defaultToToken.networkId);
        }
        if (defaultFromToken) {
          checkSupportTokenSwapType(defaultFromToken, true);
        }
      }
    }
  }, [
    params?.importFromToken,
    params?.importToToken,
    params?.importNetworkId,
    params?.swapTabSwitchType,
    skipSyncDefaultSelectedToken,
    syncNetworksSort,
    checkSupportTokenSwapType,
    setFromToken,
    setToToken,
    needChangeToken,
  ]);

  useEffect(() => {
    void (async () => {
      const swapConfigs =
        await backgroundApiProxy.serviceSwap.fetchSwapConfigs();
      if (swapConfigs?.swapMevNetConfig) {
        setSwapMevConfig({
          swapMevNetConfig: swapConfigs.swapMevNetConfig,
        });
      }
    })();
  }, [setSwapMevConfig]);

  useEffect(() => {
    void (async () => {
      const tips = await backgroundApiProxy.serviceSwap.fetchSwapTips();
      const simpleDbTips =
        await backgroundApiProxy.simpleDb.swapConfigs.getSwapUserCloseTips();
      if (tips && !simpleDbTips.includes(tips.tipsId)) {
        setSwapTips(tips);
      }
    })();
  }, [setSwapTips]);

  useEffect(() => {
    void (async () => {
      await backgroundApiProxy.serviceSwap.swapRecentTokenSync();
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchSwapNetworks();
    })();
  }, [fetchSwapNetworks, swapNetworks.length]);

  useEffect(() => {
    void (async () => {
      await fetchSyncSwapProviderManager();
    })();
  }, [fetchSyncSwapProviderManager]);

  useEffect(() => {
    void (async () => {
      if (
        params?.importNetworkId &&
        swapAddressInfoRef.current?.networkId &&
        params?.importNetworkId !== swapAddressInfoRef.current.networkId
      ) {
        await updateSelectedAccountNetwork({
          num: 0,
          networkId: params?.importNetworkId,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.importNetworkId, updateSelectedAccountNetwork]);

  useEffect(() => {
    void (async () => {
      await syncDefaultSelectedToken();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    swapAddressInfo.accountInfo?.ready,
    swapNetworks.length,
    swapAddressInfo.networkId,
    params?.importFromToken,
    params?.importToToken,
    params?.importNetworkId,
  ]);

  const isModalPage = useIsModalPage();
  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (!isModalPage) {
        if (isFocus) {
          if (isHiddenModel) {
            setSkipSyncDefaultSelectedToken(true);
          } else {
            setSkipSyncDefaultSelectedToken(false);
          }
        }
      }
    },
  );

  useEffect(() => {
    if (fromToken?.networkId && fromToken?.isNative) {
      void (async () => {
        const nativeTokenConfig =
          await backgroundApiProxy.serviceSwap.fetchSwapNativeTokenConfig({
            networkId: fromToken.networkId,
          });
        setSwapNativeTokenReserveGas((pre) => {
          const find = pre.find(
            (item) => item.networkId === fromToken.networkId,
          );
          if (find) {
            return [
              ...pre.filter((item) => item.networkId !== fromToken.networkId),
              {
                networkId: fromToken.networkId,
                reserveGas: nativeTokenConfig.reserveGas,
              },
            ];
          }
          return [...pre, nativeTokenConfig];
        });
      })();
    }
  }, [fromToken?.networkId, fromToken?.isNative, setSwapNativeTokenReserveGas]);

  return {
    fetchLoading: networkListFetching,
  };
}
