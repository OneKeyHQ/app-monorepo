import { useMemo } from 'react';

import {
  Accordion,
  Icon,
  Image,
  SizableText,
  Stack,
  Switch,
  XStack,
} from '@onekeyhq/components';
import type { ISwapProviderInfo } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

interface IProviderFoldProps {
  providerInfo: ISwapProviderInfo;
  providerEnable: boolean;
  serviceDisable: boolean;
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
  onProviderSwitchEnable: (enable: boolean) => void;
}

export const ProviderSwitch = ({
  providerInfo,
  providerEnable,
  onProviderSwitchEnable,
  withNetwork,
  serviceDisable,
  openFold,
}: IProviderSwitchProps) => {
  return (
    <XStack justifyContent="space-between" mb={openFold ? '$2' : '$0'}>
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
      </XStack>
      <XStack alignItems="center" gap="$2">
        {!openFold ? (
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
        ) : null}
        {withNetwork ? (
          <Stack animation="quick" rotate={openFold ? '180deg' : '0deg'}>
            <Icon
              name="ChevronDownSmallOutline"
              color={openFold ? '$iconActive' : '$iconSubdued'}
              size="$5"
            />
          </Stack>
        ) : null}
      </XStack>
    </XStack>
  );
};

interface INetworkSwitchProps {
  networkId: string;
  networkName: string;
  logo?: string;
  enable: boolean;
  serviceDisable?: boolean;
  onNetworkSwitch: (networkId: string, value: boolean) => void;
}

const NetworkSwitch = ({
  networkId,
  networkName,
  logo,
  enable,
  serviceDisable,
  onNetworkSwitch,
}: INetworkSwitchProps) => {
  return (
    <XStack justifyContent="space-between">
      <XStack alignItems="center" gap="$2">
        <Image source={{ uri: logo }} borderRadius="$full" w="$4" h="$4" />
        <SizableText size="$bodyLg" color="$textSubdued">
          {networkName}
        </SizableText>
      </XStack>
      <Switch
        size="small"
        value={serviceDisable ? false : enable}
        disabled={serviceDisable}
        onChange={(value) => {
          onNetworkSwitch(networkId, value);
        }}
      />
    </XStack>
  );
};

const ProviderFold = ({
  providerInfo,
  providerEnable,
  serviceDisable,
  providerDisableNetworks,
  providerSupportNetworks,
  onProviderSwitchEnable,
  onProviderNetworkEnable,
}: IProviderFoldProps) => {
  const parsSupportNetwork = useMemo(() => {
    const evmNet = providerSupportNetworks?.filter((p) =>
      p.networkId.startsWith('evm'),
    );
    const noEvmNet = providerSupportNetworks?.filter(
      (p) => !p.networkId.startsWith('evm'),
    );
    let res = noEvmNet.map((n) => ({
      networkName: n.symbol,
      logo: n.logoURI,
      networkId: n.networkId,
      enable: true,
    }));
    if (evmNet?.length) {
      const ethNet = evmNet.find((n) => n.networkId === 'evm--1');
      res = [
        {
          networkName: 'EVM',
          logo: ethNet?.logoURI,
          networkId: 'evm',
          enable: true,
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
    return res;
  }, [providerDisableNetworks, providerSupportNetworks]);
  return (
    <Accordion type="single" collapsible>
      <Accordion.Item value="1">
        <Accordion.Trigger
          unstyled
          borderWidth={0}
          bg="$transparent"
          p="$0"
          disabled={serviceDisable}
          cursor={serviceDisable ? 'not-allowed' : 'pointer'}
        >
          {({ open }: { open: boolean }) => (
            <ProviderSwitch
              providerEnable={providerEnable}
              providerInfo={providerInfo}
              withNetwork={parsSupportNetwork?.length > 0}
              onProviderSwitchEnable={onProviderSwitchEnable}
              openFold={open}
              serviceDisable={serviceDisable}
            />
          )}
        </Accordion.Trigger>
        <Accordion.HeightAnimator animation="quick">
          <Accordion.Content
            p="$0"
            animation="quick"
            gap="$2"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          >
            {parsSupportNetwork.map((net) => (
              <NetworkSwitch
                key={`${providerInfo.provider} - ${net.networkId}`}
                networkId={net.networkId}
                enable={net.enable}
                logo={net.logo}
                networkName={net.networkName}
                onNetworkSwitch={onProviderNetworkEnable}
              />
            ))}
          </Accordion.Content>
        </Accordion.HeightAnimator>
      </Accordion.Item>
    </Accordion>
  );
};

export default ProviderFold;
