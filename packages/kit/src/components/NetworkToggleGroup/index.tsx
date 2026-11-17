import { memo, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import { Stack, XStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { NetworksFilterItem } from '../NetworksFilterItem';

export type INetworkToggleGroupItem = {
  networkId: string;
  name: string;
  logoURI?: string;
  isAllNetworks?: boolean;
};

export type INetworkToggleGroupProps<
  T extends INetworkToggleGroupItem = INetworkToggleGroupItem,
> = {
  networks: T[];
  sameChainNetwork?: T;
  sameChainBadgeText?: string;
  maxVisibleNetworks: number;
  fitToAvailableWidth?: boolean;
  disableNetworks?: string[];
  onSelectNetwork: (network: T) => void;
  selectedNetwork?: T;
  onMoreNetwork: () => void;
  onDisableNetworksClick?: () => void;
  testIDPrefix?: string;
};

function NetworkToggleGroup<
  T extends INetworkToggleGroupItem = INetworkToggleGroupItem,
>({
  networks,
  sameChainNetwork,
  sameChainBadgeText,
  maxVisibleNetworks,
  fitToAvailableWidth = false,
  selectedNetwork,
  onSelectNetwork,
  disableNetworks,
  onMoreNetwork,
  onDisableNetworksClick,
  testIDPrefix,
}: INetworkToggleGroupProps<T>) {
  const { width, fontScale } = useWindowDimensions();
  const { gtMd } = useMedia();
  const intl = useIntl();
  const [availableWidth, setAvailableWidth] = useState<number>();
  const [sameChainMeasurement, setSameChainMeasurement] = useState<{
    key: string;
    width: number;
  }>();
  const isWiderScreen = width > 380;
  const defaultVisibleNetworkCount = isWiderScreen
    ? maxVisibleNetworks
    : Math.max(maxVisibleNetworks - 1, 1);
  const gap = gtMd ? 6 : 3;
  const moreWidth = 56;
  // $6 icon, two $2 paddings, and two 1px borders.
  const networkWidth = 42;
  const sameChainMeasureKey = `${sameChainNetwork?.networkId ?? ''}\0${sameChainNetwork?.name ?? ''}\0${sameChainBadgeText ?? ''}\0${gtMd}\0${fontScale}`;
  const sameChainWidth =
    sameChainMeasurement?.key === sameChainMeasureKey
      ? sameChainMeasurement.width
      : undefined;
  const visibleNetworkCount = useMemo(() => {
    if (!fitToAvailableWidth || availableWidth === undefined) {
      return defaultVisibleNetworkCount;
    }
    const leadingWidth = sameChainNetwork ? (sameChainWidth ?? 0) + 1 : 0;
    const leadingItems = sameChainNetwork ? 2 : 0;
    const fits = (count: number, showMore: boolean) => {
      const itemCount = leadingItems + count + (showMore ? 1 : 0);
      return (
        leadingWidth +
          count * networkWidth +
          (showMore ? moreWidth : 0) +
          Math.max(itemCount - 1, 0) * gap <=
        availableWidth
      );
    };
    if (fits(networks.length, false)) {
      return networks.length;
    }
    for (let count = networks.length - 1; count > 0; count -= 1) {
      if (fits(count, true)) {
        return count;
      }
    }
    return 0;
  }, [
    availableWidth,
    defaultVisibleNetworkCount,
    fitToAvailableWidth,
    gap,
    networks.length,
    sameChainNetwork,
    sameChainWidth,
  ]);
  const filteredNetworks = useMemo(
    () => networks.slice(0, visibleNetworkCount),
    [networks, visibleNetworkCount],
  );
  const moreNetworks = useMemo(
    () => networks.slice(visibleNetworkCount),
    [networks, visibleNetworkCount],
  );
  const shouldCompressSameChain =
    fitToAvailableWidth &&
    moreNetworks.length > 0 &&
    sameChainWidth !== undefined &&
    availableWidth !== undefined &&
    availableWidth < sameChainWidth + 1 + moreWidth + 2 * gap;
  const disableMoreNetworks =
    moreNetworks.length > 0 &&
    moreNetworks.every((network) =>
      disableNetworks?.includes(network.networkId),
    );

  const getNetworkOnPress = (network: T) =>
    disableNetworks?.includes(network.networkId)
      ? () => {
          onDisableNetworksClick?.();
        }
      : () => {
          onSelectNetwork(network);
        };

  const items = (
    <>
      {sameChainNetwork ? (
        <>
          <NetworksFilterItem
            key={fitToAvailableWidth ? sameChainMeasureKey : undefined}
            testID={
              testIDPrefix
                ? `${testIDPrefix}-${sameChainNetwork.networkId}`
                : undefined
            }
            disabled={Boolean(
              disableNetworks?.includes(sameChainNetwork.networkId),
            )}
            networkImageUri={sameChainNetwork.logoURI}
            badgeText={sameChainBadgeText}
            keepNetworkImageSize
            tooltipContent={sameChainNetwork.name}
            isSelected={
              sameChainNetwork.networkId === selectedNetwork?.networkId
            }
            px="$2"
            py="$1.5"
            h="$9"
            alignItems="center"
            gap="$1.5"
            borderWidth={1}
            flexShrink={shouldCompressSameChain ? 1 : 0}
            minWidth={fitToAvailableWidth ? 0 : undefined}
            $gtMd={{ gap: 5 }}
            onLayout={
              fitToAvailableWidth
                ? (event) => {
                    if (shouldCompressSameChain) return;
                    const measuredWidth = event.nativeEvent.layout.width;
                    setSameChainMeasurement((current) =>
                      current?.key === sameChainMeasureKey &&
                      current.width === measuredWidth
                        ? current
                        : { key: sameChainMeasureKey, width: measuredWidth },
                    );
                  }
                : undefined
            }
            onPress={getNetworkOnPress(sameChainNetwork)}
          />
          <Stack w={1} h="$6" bg="$border" flexShrink={0} />
        </>
      ) : null}
      {filteredNetworks.map((network) => (
        <NetworksFilterItem
          key={network.networkId}
          testID={
            testIDPrefix ? `${testIDPrefix}-${network.networkId}` : undefined
          }
          disabled={Boolean(disableNetworks?.includes(network.networkId))}
          networkImageUri={network.logoURI}
          isAllNetworks={network.isAllNetworks}
          tooltipContent={
            network.isAllNetworks
              ? intl.formatMessage({ id: ETranslations.global_all_networks })
              : network.name
          }
          isSelected={network.networkId === selectedNetwork?.networkId}
          keepNetworkImageSize
          px="$2"
          py="$1.5"
          h="$9"
          alignItems="center"
          borderWidth={1}
          flexShrink={0}
          width={fitToAvailableWidth ? networkWidth : undefined}
          onPress={getNetworkOnPress(network)}
        />
      ))}
      {moreNetworks.length > 0 ? (
        <NetworksFilterItem
          testID={testIDPrefix ? `${testIDPrefix}-more` : undefined}
          disabled={disableMoreNetworks}
          networkName={`${moreNetworks.length}+`}
          networkNameProps={{
            color: '$text',
            $gtMd: {
              color: '$textSubdued',
              size: '$bodyMdMedium',
            },
          }}
          px="$2"
          py="$1.5"
          h="$9"
          alignItems="center"
          borderWidth={1}
          minWidth={fitToAvailableWidth ? moreWidth : 0}
          width={fitToAvailableWidth ? moreWidth : undefined}
          flex={fitToAvailableWidth ? undefined : 1}
          flexShrink={fitToAvailableWidth ? 0 : undefined}
          onPress={disableMoreNetworks ? undefined : onMoreNetwork}
        />
      ) : null}
    </>
  );

  return (
    <XStack
      px="$5"
      pt="$1"
      pb="$3"
      gap={3}
      alignItems="center"
      $gtMd={{ gap: '$1.5' }}
    >
      {fitToAvailableWidth ? (
        <XStack
          testID={testIDPrefix ? `${testIDPrefix}-layout` : undefined}
          flex={1}
          minWidth={0}
          gap={3}
          alignItems="center"
          $gtMd={{ gap: '$1.5' }}
          onLayout={(event) =>
            setAvailableWidth(event.nativeEvent.layout.width)
          }
        >
          {items}
        </XStack>
      ) : (
        items
      )}
    </XStack>
  );
}

export default memo(NetworkToggleGroup) as typeof NetworkToggleGroup;
