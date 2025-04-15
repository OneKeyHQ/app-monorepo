import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Accordion, Button, YStack } from '@onekeyhq/components';
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
            return {
              ...item,
              enable,
              disableNetworks: enable ? [] : [...(item.supportNetworks ?? [])],
            };
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
            if (enable) {
              const disNetsEnable = item.supportNetworks?.filter(
                (net) =>
                  net.networkId.split('--')[0] === networkId.split('--')[0],
              );
              if (disNetsEnable?.length) {
                return {
                  ...item,
                  enable: true,
                  disableNetworks: (item.disableNetworks ?? []).filter(
                    (net) =>
                      !disNetsEnable.find(
                        (n) =>
                          n.networkId.split('--')[0] ===
                          net.networkId.split('--')[0],
                      ),
                  ),
                };
              }
            } else {
              const disNets = item.supportNetworks?.filter(
                (net) =>
                  net.networkId.split('--')[0] === networkId.split('--')[0],
              );
              if (disNets?.length) {
                return {
                  ...item,
                  disableNetworks: [
                    ...(item.disableNetworks ?? []),
                    ...disNets,
                  ],
                };
              }
            }
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
    <YStack>
      <Accordion type="single" pb="$5" collapsible gap="$2">
        {isBridge
          ? providerManageNewData.map((item) => (
              <ProviderSwitch
                serviceDisable={item.serviceDisable}
                isBridge={isBridge}
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
                serviceDisableNetworks={item.serviceDisableNetworks ?? []}
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
      </Accordion>
      <Button loading={isSaving} variant="primary" onPress={() => onSave()}>
        {intl.formatMessage({ id: ETranslations.action_save })}
      </Button>
    </YStack>
  );
};

export default ProviderManageContainer;
