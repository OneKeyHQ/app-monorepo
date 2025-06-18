import { memo, useCallback } from 'react';

import { Button, Image, SizableText, XStack } from '@onekeyhq/components';
import type { IPopoverProps } from '@onekeyhq/components';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { MarketTokenListNetworkSelectorSmallSkeleton } from './MarketTokenListNetworkSelectorSmallSkeleton';
import { MoreButton } from './MoreButton';

interface IMarketTokenListNetworkSelectorSmallProps {
  marketNetworks: ISwapNetwork[];
  currentSelectNetwork?: ISwapNetwork;
  onSelectCurrentNetwork: (network: ISwapNetwork) => void;
  isLoading?: boolean;
  forceLoading?: boolean;
  placement?: IPopoverProps['placement'];
}

interface ICustomTriggerProps {
  isOpen: boolean;
  onPress: () => void;
  currentSelectNetwork?: ISwapNetwork;
}

const CustomTrigger = memo(
  ({ isOpen, onPress, currentSelectNetwork }: ICustomTriggerProps) => (
    <Button
      onPress={onPress}
      variant="tertiary"
      size="small"
      iconAfter={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
    >
      <XStack alignItems="center" gap="$2" flex={1}>
        {currentSelectNetwork?.logoURI ? (
          <Image
            height="$4.5"
            width="$4.5"
            borderRadius="$full"
            source={{ uri: currentSelectNetwork.logoURI }}
          />
        ) : null}
        <SizableText size="$bodyMdMedium" color="$text" flex={1}>
          {currentSelectNetwork?.name || 'Select Network'}
        </SizableText>
      </XStack>
    </Button>
  ),
);

CustomTrigger.displayName = 'CustomTrigger';

function MarketTokenListNetworkSelectorSmall({
  marketNetworks,
  currentSelectNetwork,
  onSelectCurrentNetwork,
  isLoading,
  forceLoading,
  placement,
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
    return <MarketTokenListNetworkSelectorSmallSkeleton />;
  }

  return (
    <MoreButton
      networks={marketNetworks}
      selectedNetworkId={currentSelectNetwork?.networkId}
      onNetworkSelect={onSelectCurrentNetwork}
      customTrigger={customTrigger}
      placement={placement}
    />
  );
}

const MarketTokenListNetworkSelectorSmallComponent = memo(
  MarketTokenListNetworkSelectorSmall,
);

export { MarketTokenListNetworkSelectorSmallComponent as MarketTokenListNetworkSelectorSmall };
