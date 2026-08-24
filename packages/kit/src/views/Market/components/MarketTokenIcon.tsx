import { memo } from 'react';

import { Token } from '../../../components/Token';

import type { ITokenProps } from '../../../components/Token';

function BasicMarketTokenIcon({
  uri,
  uris,
  size,
  networkId,
  tokenAddress,
  isNative,
}: {
  uri: string;
  uris?: string[];
  size: ITokenProps['size'];
  networkId?: string;
  tokenAddress?: string;
  isNative?: boolean;
}) {
  return (
    <Token
      size={size}
      tokenImageUri={uri}
      tokenImageUris={uris}
      networkId={networkId}
      tokenAddress={tokenAddress}
      tokenIsNative={isNative}
      showNetworkIcon={Boolean(networkId)}
    />
  );
}

export const MarketTokenIcon = memo(BasicMarketTokenIcon);
