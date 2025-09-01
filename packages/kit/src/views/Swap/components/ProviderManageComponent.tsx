import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  Badge,
  Icon,
  Image,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISwapProviderInfo } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

interface IProviderFoldProps {
  providerInfo: ISwapProviderInfo;
  providerEnable: boolean;
  serviceDisable: boolean;
  serviceDisableNetworks: ISwapNetwork[];
  providerSupportNetworks: ISwapNetwork[];
  providerDisableNetworks: ISwapNetwork[];
  onProviderSwitchEnable: (enable: boolean) => void;
  onProviderNetworkEnable: (networkId: string, enable: boolean) => void;
}

interface IProviderSwitchProps {
  providerInfo: ISwapProviderInfo;
  providerEnable: boolean;
  withNetwork?: boolean;
  openFold?: boolean;
  serviceDisable?: boolean;
  isBridge?: boolean;
  onProviderSwitchEnable: (enable: boolean) => void;
}

export const ProviderSwitch = ({
  providerInfo,
  providerEnable,
  onProviderSwitchEnable,
  serviceDisable,
  openFold,
  isBridge,
}: IProviderSwitchProps) => {
  const intl = useIntl();
  return (
    <XStack justifyContent="space-between" p="$1">
      <XStack alignItems="center" gap="$2">
        {isBridge ? null : (
          <Icon
            name={
              openFold ? 'ChevronDownSmallOutline' : 'ChevronRightSmallOutline'
            }
            color={openFold ? '$iconActive' : '$iconSubdued'}
            size="$5"
          />
        )}
        <XStack alignItems="center" gap="$2">
          <Image
            source={{ uri: providerInfo.logo }}
            borderRadius="$1"
            w="$5"
            h="$5"
          />
          <SizableText size="$bodyLgMedium">
            {providerInfo.providerName}
          </SizableText>
          {serviceDisable ? (
            <Badge
              bg="$bgSubdued"
              borderRadius="$2.5"
              h="$6"
              borderWidth={1}
              borderColor="$borderCritical"
            >
              <SizableText size="$bodySm" color="$textCritical">
                {intl.formatMessage({
                  id: ETranslations.provider_unavailable,
                })}
              </SizableText>
            </Badge>
          ) : null}
        </XStack>
      </XStack>
      <XStack animation="quick" gap="$2">
        <Stack
          onPress={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Switch
            value={serviceDisable ? false : providerEnable}
            size="small"
            disabled={serviceDisable}
            onChange={onProviderSwitchEnable}
          />
        </Stack>
      </XStack>
    </XStack>
  );
};

interface INetworkSwitchProps {
  networkId: string;
  networkName: string;
  enable: boolean;
  serviceDisable?: boolean;
  onNetworkSwitch: (networkId: string, value: boolean) => void;
}

const NetworkSwitch = ({
  networkId,
  networkName,
  enable,
  serviceDisable,
  onNetworkSwitch,
}: INetworkSwitchProps) => {
  return (
    <Badge
      bg={enable ? '$bgSubdued' : '$bgApp'}
      borderRadius="$2.5"
      h="$6"
      borderWidth={1}
      borderCurve="continuous"
      borderColor={enable ? '$borderActive' : '$borderSubdued'}
      disabled={serviceDisable}
      onPress={() => {
        onNetworkSwitch(networkId, !enable);
      }}
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
      cursor="pointer"
    >
      <SizableText
        size={enable ? '$bodySmMedium' : '$bodySm'}
        color={enable ? '$text' : '$textSubdued'}
      >
        {networkName}
      </SizableText>
    </Badge>
  );
};

const ProviderFold = ({
  providerInfo,
  providerEnable,
  serviceDisable,
  serviceDisableNetworks,
  providerDisableNetworks,
  providerSupportNetworks,
  onProviderSwitchEnable,
  onProviderNetworkEnable,
}: IProviderFoldProps) => {
  const parsSupportNetwork = useMemo(() => {
    const evmNet = providerSupportNetworks?.filter((p) =>
      p.networkId.startsWith('evm'),
    );
    let noEvmNet = providerSupportNetworks?.filter(
      (p) => !p.networkId.startsWith('evm'),
    );
    noEvmNet = noEvmNet.map((n) => {
      const net = networkUtils.getLocalNetworkInfo(n.networkId);
      return {
        ...n,
        name: net?.name ?? n.name,
        shortcode: net?.shortname,
      };
    });
    let res = noEvmNet.map((n) => ({
      networkName: n.name || n.shortcode || n.symbol,
      logo: n.logoURI,
      networkId: n.networkId,
      enable: true,
      serviceDisable: false,
    }));
    if (evmNet?.length) {
      const ethNet = evmNet.find((n) => n.networkId === 'evm--1');
      res = [
        {
          networkName: 'EVM',
          logo: ethNet?.logoURI,
          networkId: 'evm',
          enable: true,
          serviceDisable: false,
        },
        ...res,
      ];
    }
    res = res.map((net) => {
      const findDisNet = providerDisableNetworks.find(
        (disN) =>
          net.networkId.split('--')[0] === disN.networkId.split('--')[0],
      );
      if (findDisNet) {
        return { ...net, enable: false };
      }
      return net;
    });
    res = res.map((net) => {
      const findServerDisNet = serviceDisableNetworks.find(
        (disN) =>
          net.networkId.split('--')[0] === disN.networkId.split('--')[0],
      );
      if (findServerDisNet) {
        return { ...net, serviceDisable: true };
      }
      return net;
    });

    return res;
  }, [
    providerDisableNetworks,
    providerSupportNetworks,
    serviceDisableNetworks,
  ]);
  const intl = useIntl();
  return (
    <Accordion.Item value={providerInfo.provider}>
      <Accordion.Trigger
        unstyled
        borderWidth={0}
        bg="$transparent"
        p="$0"
        disabled={serviceDisable}
        cursor={serviceDisable ? 'not-allowed' : 'pointer'}
        hoverStyle={{ bg: '$bgHover', borderRadius: '$2' }}
      >
        {({ open }: { open: boolean }) => (
          <ProviderSwitch
            providerEnable={providerEnable}
            providerInfo={providerInfo}
            withNetwork={!!(parsSupportNetwork?.length > 0 && !serviceDisable)}
            onProviderSwitchEnable={onProviderSwitchEnable}
            openFold={open}
            serviceDisable={serviceDisable}
          />
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator animation="quick">
        <Accordion.Content
          animation="quick"
          bg="$transparent"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          p="$0"
        >
          <YStack pt="$3" gap="$3" px="$8">
            <Stack
              flexWrap="wrap"
              alignItems="center"
              flexDirection="row"
              gap="$2"
            >
              {parsSupportNetwork.map((net) => (
                <NetworkSwitch
                  key={`${providerInfo.provider} - ${net.networkId}`}
                  networkId={net.networkId}
                  enable={net.enable}
                  serviceDisable={net.serviceDisable}
                  networkName={net.networkName}
                  onNetworkSwitch={onProviderNetworkEnable}
                />
              ))}
            </Stack>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.swap_settings_manage_chain_tip,
              })}
            </SizableText>
          </YStack>
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
};

export default ProviderFold;
