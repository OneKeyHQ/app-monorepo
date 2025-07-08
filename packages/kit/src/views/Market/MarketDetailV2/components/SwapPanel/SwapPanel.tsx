import { Spinner, Stack } from '@onekeyhq/components';

import { SwapPanelWrap } from './SwapPanelWrap';

export function SwapPanel({
  networkId,
  tokenAddress,
}: {
  networkId?: string;
  tokenAddress?: string;
}) {
  if (!networkId || !tokenAddress) {
    return (
      <Stack
        minHeight={400}
        justifyContent="center"
        alignItems="center"
        width="full"
      >
        <Spinner />
      </Stack>
    );
  }

  return <SwapPanelWrap />;
}
