import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  Button,
  ScrollView,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { normalizeSwapProviderManagersForSave } from '@onekeyhq/shared/src/utils/swapProviderManagerUtils';
import type { ISwapProviderManager } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import ProviderManageComponent, {
  ProviderSwitch,
} from '../../components/ProviderManageComponent';

type IProviderManageMode = 'singleSwap' | 'crossChain';

interface IProviderManageContainerProps {
  mode: IProviderManageMode;
  onSaved: () => void;
}

const PROVIDER_MANAGE_LIST_MAX_HEIGHT = {
  desktop: 360,
  mobile: '$80',
} as const;

function syncProviderManagerUnifiedSettings(
  providerManager: ISwapProviderManager,
  mode: IProviderManageMode,
) {
  return normalizeSwapProviderManagersForSave([providerManager], mode)[0];
}

function getProviderSupportNetworks(
  providerManager: ISwapProviderManager,
  mode: IProviderManageMode,
) {
  if (mode === 'singleSwap') {
    return (
      providerManager.supportSingleSwapNetworks ??
      providerManager.supportNetworks ??
      []
    );
  }

  return (
    providerManager.supportCrossChainNetworks ??
    (providerManager.isSupportCrossChain !== undefined
      ? providerManager.supportNetworks
      : []) ??
    []
  );
}

function getProviderDisableNetworks(
  providerManager: ISwapProviderManager,
  mode: IProviderManageMode,
) {
  if (mode === 'singleSwap') {
    return (
      providerManager.singleSwapDisableNetworks ??
      providerManager.disableNetworks ??
      []
    );
  }

  return (
    providerManager.crossChainDisableNetworks ??
    (providerManager.isSupportCrossChain !== undefined
      ? providerManager.disableNetworks
      : []) ??
    []
  );
}

function getProviderEnable(
  providerManager: ISwapProviderManager,
  mode: IProviderManageMode,
) {
  if (mode === 'singleSwap') {
    return providerManager.singleSwapEnable ?? providerManager.enable ?? true;
  }

  return providerManager.crossChainEnable ?? providerManager.enable ?? true;
}

function isProviderSupportMode(
  providerManager: ISwapProviderManager,
  mode: IProviderManageMode,
) {
  const supportNetworks = getProviderSupportNetworks(providerManager, mode);
  if (mode === 'singleSwap') {
    return (
      providerManager.isSupportSingleSwap !== false &&
      supportNetworks.length > 0
    );
  }

  return (
    providerManager.isSupportCrossChain !== false && supportNetworks.length > 0
  );
}

function uniqueProviderNetworks(networks: ISwapNetwork[]) {
  const networkMap = new Map<string, ISwapNetwork>();
  networks.forEach((network) => {
    if (!networkMap.has(network.networkId)) {
      networkMap.set(network.networkId, network);
    }
  });
  return Array.from(networkMap.values());
}

const ProviderManageContainer = ({
  mode,
  onSaved,
}: IProviderManageContainerProps) => {
  const intl = useIntl();
  const media = useMedia();
  const [{ swapProviderManager, bridgeProviderManager }] =
    useInAppNotificationAtom();
  const hasUnifiedCrossChainProviderManagers = useMemo(
    () =>
      swapProviderManager.some((item) =>
        isProviderSupportMode(item, 'crossChain'),
      ),
    [swapProviderManager],
  );
  const isLegacyBridgeProviderManagerFallback =
    mode === 'crossChain' &&
    !hasUnifiedCrossChainProviderManagers &&
    bridgeProviderManager.length > 0;
  const providerManagers = isLegacyBridgeProviderManagerFallback
    ? bridgeProviderManager
    : swapProviderManager;
  const [providerManageNewData, setProviderManageNewData] =
    useState<ISwapProviderManager[]>(providerManagers);
  useEffect(() => {
    setProviderManageNewData(providerManagers);
  }, [providerManagers]);
  const [isSaving, setIsSaving] = useState(false);
  const onProviderSwitchEnable = useCallback(
    (provider: string, enable: boolean) => {
      setProviderManageNewData(
        providerManageNewData.map((item) => {
          if (item.providerInfo.provider === provider) {
            if (isLegacyBridgeProviderManagerFallback) {
              return {
                ...item,
                enable,
              };
            }
            const supportNetworks = getProviderSupportNetworks(item, mode);
            return syncProviderManagerUnifiedSettings(
              {
                ...item,
                enable,
                disableNetworks: enable ? [] : [...supportNetworks],
              },
              mode,
            );
          }
          return item;
        }),
      );
    },
    [isLegacyBridgeProviderManagerFallback, mode, providerManageNewData],
  );
  const onProviderNetworkEnable = useCallback(
    (provider: string, networkId: string, enable: boolean) => {
      setProviderManageNewData(
        providerManageNewData.map((item) => {
          if (item.providerInfo.provider === provider) {
            const supportNetworks = getProviderSupportNetworks(item, mode);
            const currentDisableNetworks = getProviderDisableNetworks(
              item,
              mode,
            );
            const disNetsEnable = networkId.startsWith('evm')
              ? supportNetworks.filter(
                  (net) =>
                    net.networkId.split('--')[0] === networkId.split('--')[0],
                )
              : supportNetworks.filter((net) => net.networkId === networkId);
            const providerEnable = getProviderEnable(item, mode);
            if (enable) {
              if (disNetsEnable?.length) {
                return syncProviderManagerUnifiedSettings(
                  {
                    ...item,
                    enable: true,
                    disableNetworks: currentDisableNetworks.filter(
                      (net) =>
                        !disNetsEnable.find(
                          (n) => net.networkId === n.networkId,
                        ),
                    ),
                  },
                  mode,
                );
              }
            } else if (disNetsEnable?.length) {
              return syncProviderManagerUnifiedSettings(
                {
                  ...item,
                  enable: providerEnable,
                  disableNetworks: uniqueProviderNetworks([
                    ...currentDisableNetworks,
                    ...disNetsEnable,
                  ]),
                },
                mode,
              );
            }
          }
          return item;
        }),
      );
    },
    [mode, providerManageNewData],
  );
  const onSave = useCallback(async () => {
    setIsSaving(true);
    await backgroundApiProxy.serviceSwap.updateSwapProviderManager(
      providerManageNewData,
      isLegacyBridgeProviderManagerFallback,
    );
    setIsSaving(false);
    onSaved();
  }, [isLegacyBridgeProviderManagerFallback, onSaved, providerManageNewData]);

  const providerManageListMaxHeight = media.gtMd
    ? PROVIDER_MANAGE_LIST_MAX_HEIGHT.desktop
    : PROVIDER_MANAGE_LIST_MAX_HEIGHT.mobile;

  return (
    <YStack>
      <ScrollView
        maxHeight={providerManageListMaxHeight}
        mx="$-5"
        px="$5"
        pb="$5"
        nestedScrollEnabled
        contentContainerStyle={{
          pb: '$1',
        }}
      >
        <Accordion type="single" collapsible gap="$2">
          {providerManageNewData
            .filter(
              (item) =>
                isLegacyBridgeProviderManagerFallback ||
                isProviderSupportMode(item, mode),
            )
            .map((item) =>
              isLegacyBridgeProviderManagerFallback ? (
                <ProviderSwitch
                  key={item.providerInfo.provider}
                  providerInfo={item.providerInfo}
                  providerEnable={item.enable ?? true}
                  serviceDisable={!!item.serviceDisable}
                  isBridge
                  onProviderSwitchEnable={(enable) => {
                    onProviderSwitchEnable(item.providerInfo.provider, enable);
                  }}
                />
              ) : (
                <ProviderManageComponent
                  key={item.providerInfo.provider}
                  providerInfo={item.providerInfo}
                  providerEnable={getProviderEnable(item, mode)}
                  serviceDisable={!!item.serviceDisable}
                  serviceDisableNetworks={item.serviceDisableNetworks ?? []}
                  providerSupportNetworks={getProviderSupportNetworks(
                    item,
                    mode,
                  )}
                  providerDisableNetworks={getProviderDisableNetworks(
                    item,
                    mode,
                  )}
                  onProviderSwitchEnable={(enable) => {
                    onProviderSwitchEnable(item.providerInfo.provider, enable);
                  }}
                  onProviderNetworkEnable={(networkId, enable) => {
                    onProviderNetworkEnable(
                      item.providerInfo.provider,
                      networkId,
                      enable,
                    );
                  }}
                />
              ),
            )}
        </Accordion>
      </ScrollView>
      <YStack pt="$4">
        <Button
          loading={isSaving}
          variant="primary"
          onPress={() => onSave()}
          testID="swap-btn"
        >
          {intl.formatMessage({ id: ETranslations.action_save })}
        </Button>
      </YStack>
    </YStack>
  );
};

export default ProviderManageContainer;
