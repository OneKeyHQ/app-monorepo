import { useCallback, useEffect, useState } from 'react';

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
import type { ISwapProviderManager } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import ProviderManageComponent from '../../components/ProviderManageComponent';

interface IProviderManageContainerProps {
  onSaved: () => void;
}

const PROVIDER_MANAGE_LIST_MAX_HEIGHT = {
  desktop: 360,
  mobile: '$80',
} as const;

const ProviderManageContainer = ({
  onSaved,
}: IProviderManageContainerProps) => {
  const intl = useIntl();
  const media = useMedia();
  const [{ swapProviderManager }] = useInAppNotificationAtom();
  const [providerManageNewData, setProviderManageNewData] =
    useState<ISwapProviderManager[]>(swapProviderManager);
  useEffect(() => {
    setProviderManageNewData(swapProviderManager);
  }, [swapProviderManager]);
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
            const disNetsEnable = networkId.startsWith('evm')
              ? item.supportNetworks?.filter(
                  (net) =>
                    net.networkId.split('--')[0] === networkId.split('--')[0],
                )
              : item.supportNetworks?.filter(
                  (net) => net.networkId === networkId,
                );
            if (enable) {
              if (disNetsEnable?.length) {
                return {
                  ...item,
                  enable: true,
                  disableNetworks: (item.disableNetworks ?? []).filter(
                    (net) =>
                      !disNetsEnable.find((n) => net.networkId === n.networkId),
                  ),
                };
              }
            } else if (disNetsEnable?.length) {
              return {
                ...item,
                disableNetworks: [
                  ...(item.disableNetworks ?? []),
                  ...disNetsEnable,
                ],
              };
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
    );
    setIsSaving(false);
    onSaved();
  }, [onSaved, providerManageNewData]);

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
          {providerManageNewData.map((item) => (
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
