import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapProviderManager } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import ProviderManageComponent, {
  ProviderSwitch,
} from '../../components/ProviderManageComponent';

interface IProviderManageContainerProps {
  isBridge: boolean;
  onSaved: () => void;
}

const ProviderManageContainer = ({
  isBridge,
  onSaved,
}: IProviderManageContainerProps) => {
  const intl = useIntl();
  const [{ swapProviderManager, bridgeProviderManager }] =
    useInAppNotificationAtom();
  const [providerManageNewData, setProviderManageNewData] =
    useState<ISwapProviderManager[]>(swapProviderManager);
  useEffect(() => {
    if (isBridge) {
      setProviderManageNewData(bridgeProviderManager);
    } else {
      setProviderManageNewData(swapProviderManager);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBridge]);
  const [isSaving, setIsSaving] = useState(false);
  const onProviderSwitchEnable = useCallback(
    (provider: string, enable: boolean) => {
      setProviderManageNewData(
        providerManageNewData.map((item) => {
          if (item.providerInfo.provider === provider) {
            return { ...item, enable };
          }
          return item;
        }),
      );
    },
    [providerManageNewData],
  );
  const onProviderNetworkEnable = useCallback(
    (provider: string, networkId: string, enable: boolean) => {
      setProviderManageNewData(
        providerManageNewData.map((item) => {
          if (item.providerInfo.provider === provider) {
            return {
              ...item,
              supportNetworks: item.supportNetworks?.map((network) => {
                if (
                  network.networkId.split('--')[0] === networkId.split('--')[0]
                ) {
                  return { ...network, enable };
                }
                return network;
              }),
            };
          }
          return item;
        }),
      );
    },
    [providerManageNewData],
  );
  const onSave = useCallback(async () => {
    setIsSaving(true);
    await backgroundApiProxy.serviceSwap.updateSwapProviderManager(
      providerManageNewData,
      isBridge,
    );
    setIsSaving(false);
    onSaved();
  }, [onSaved, providerManageNewData, isBridge]);
  return (
    <YStack gap="$4">
      {isBridge
        ? providerManageNewData.map((item) => (
            <ProviderSwitch
              serviceDisable={item.serviceDisable}
              key={item.providerInfo.provider}
              providerInfo={item.providerInfo}
              providerEnable={item.enable}
              onProviderSwitchEnable={(enable) => {
                onProviderSwitchEnable(item.providerInfo.provider, enable);
              }}
            />
          ))
        : providerManageNewData.map((item) => (
            <ProviderManageComponent
              key={item.providerInfo.provider}
              providerInfo={item.providerInfo}
              providerEnable={item.enable}
              serviceDisable={!!item.serviceDisable}
              providerSupportNetworks={item.supportNetworks ?? []}
              providerDisableNetworks={item.disableNetworks ?? []}
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
          ))}
      <Button loading={isSaving} variant="primary" onPress={() => onSave()}>
        {intl.formatMessage({ id: ETranslations.action_save })}
      </Button>
    </YStack>
  );
};

export default ProviderManageContainer;
