import { memo, useCallback } from 'react';

import { Icon, Image, SizableText, Stack, XStack } from '@onekeyhq/components';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import MarketTokenListNetworkSelectorSmallSkeleton from './MarketTokenListNetworkSelectorSmallSkeleton';
import { MoreButton } from './MoreButton';

interface IMarketTokenListNetworkSelectorSmallProps {
  marketNetworks: ISwapNetwork[];
  currentSelectNetwork?: ISwapNetwork;
  onSelectCurrentNetwork: (network: ISwapNetwork) => void;
  isLoading?: boolean;
  forceLoading?: boolean;
}

interface ICustomTriggerProps {
  isOpen: boolean;
  onPress: () => void;
  currentSelectNetwork?: ISwapNetwork;
}

const CustomTrigger = memo(
  ({ isOpen, onPress, currentSelectNetwork }: ICustomTriggerProps) => (
    <XStack
      onPress={onPress}
      hoverStyle={{
        opacity: 0.8,
      }}
      pressStyle={{
        opacity: 0.6,
      }}
      cursor="pointer"
      alignItems="center"
      justifyContent="space-between"
      paddingVertical="$2"
      paddingHorizontal="$2"
      borderRadius="$2"
      backgroundColor="$bgSubdued"
    >
      {/* Current Network Display */}
      <XStack alignItems="center" gap="$2" flex={1}>
        {currentSelectNetwork?.logoURI ? (
          <Image
            height="$6"
            width="$6"
            borderRadius="$full"
            source={{ uri: currentSelectNetwork.logoURI }}
          />
        ) : null}
        <SizableText size="$bodyMdMedium" color="$text" flex={1}>
          {currentSelectNetwork?.name || 'Select Network'}
        </SizableText>
      </XStack>

      <Icon
        name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
        size="$4"
        color="$iconSubdued"
      />
    </XStack>
  ),
);

CustomTrigger.displayName = 'CustomTrigger';

function MarketTokenListNetworkSelectorSmall({
  marketNetworks,
  currentSelectNetwork,
  onSelectCurrentNetwork,
  isLoading,
  forceLoading,
}: IMarketTokenListNetworkSelectorSmallProps) {
  const customTrigger = useCallback(
    (isOpen: boolean, onPress: () => void) => {
      return (
        <CustomTrigger
          isOpen={isOpen}
          onPress={onPress}
          currentSelectNetwork={currentSelectNetwork}
        />
      );
    },
    [currentSelectNetwork],
  );

  if (isLoading || forceLoading) {
    return (
      <Stack paddingVertical="$3" paddingHorizontal="$5">
        <MarketTokenListNetworkSelectorSmallSkeleton />
      </Stack>
    );
  }

  return (
    <Stack paddingVertical="$3" paddingHorizontal="$5">
      <MoreButton
        networks={marketNetworks}
        selectedNetworkId={currentSelectNetwork?.networkId}
        onNetworkSelect={onSelectCurrentNetwork}
        customTrigger={customTrigger}
      />
    </Stack>
  );
}

const MarketTokenListNetworkSelectorSmallComponent = memo(
  MarketTokenListNetworkSelectorSmall,
);

export default MarketTokenListNetworkSelectorSmallComponent;
