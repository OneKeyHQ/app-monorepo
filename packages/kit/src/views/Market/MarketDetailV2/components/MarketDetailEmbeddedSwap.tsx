import { Stack } from '@onekeyhq/components';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { MarketEmbeddedSwap } from '../layouts/MarketEmbeddedSwap';

export function MarketDetailEmbeddedSwap({
  resetKey,
  swapToken,
  testID,
}: {
  resetKey?: string;
  swapToken: ISwapToken;
  testID: string;
}) {
  const targetKey =
    resetKey ||
    [
      swapToken.networkId,
      swapToken.isNative ? 'native' : swapToken.contractAddress,
    ].join(':');
  return (
    <Stack testID={testID} width="100%" minHeight={520} overflow="hidden">
      <MarketEmbeddedSwap swapToken={swapToken} inputDraftKey={targetKey} />
    </Stack>
  );
}
