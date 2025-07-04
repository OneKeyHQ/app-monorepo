import { Spinner, Stack } from '@onekeyhq/components';

import { SwapPanelWrap } from './SwapPanelWrap';

export function SwapPanel({
  loading,
  networkId,
  tokenAddress,
}: {
  loading?: boolean;
  networkId?: string;
  tokenAddress?: string;
}) {
  if (loading || !networkId || !tokenAddress) {
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
