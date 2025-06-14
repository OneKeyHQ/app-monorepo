import { memo } from 'react';

import { Image, SizableText, Stack, XStack } from '@onekeyhq/components';
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

function MarketTokenListNetworkSelectorSmall({
  marketNetworks,
  currentSelectNetwork,
  onSelectCurrentNetwork,
  isLoading,
  forceLoading,
}: IMarketTokenListNetworkSelectorSmallProps) {
  return (
    <Stack paddingVertical="$3" paddingHorizontal="$5">
      {isLoading || forceLoading ? (
        <MarketTokenListNetworkSelectorSmallSkeleton />
      ) : (
        <XStack alignItems="center" gap="$3">
          {/* Current Network Display */}
          {currentSelectNetwork ? (
            <XStack alignItems="center" gap="$2">
              {currentSelectNetwork.logoURI ? (
                <Image
                  height="$6"
                  width="$6"
                  borderRadius="$full"
                  source={{ uri: currentSelectNetwork.logoURI }}
                />
              ) : null}
              <SizableText size="$bodyMdMedium" color="$text">
                {currentSelectNetwork.name}
              </SizableText>
            </XStack>
          ) : null}

          {/* More Button */}
          <MoreButton
            networks={marketNetworks}
            selectedNetworkId={currentSelectNetwork?.networkId}
            onNetworkSelect={onSelectCurrentNetwork}
          />
        </XStack>
      )}
    </Stack>
  );
}

const MarketTokenListNetworkSelectorSmallComponent = memo(
  MarketTokenListNetworkSelectorSmall,
);

export default MarketTokenListNetworkSelectorSmallComponent;
