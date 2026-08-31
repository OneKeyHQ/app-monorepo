import { memo } from 'react';

import { Token } from '../../../components/Token';

import type { ITokenProps } from '../../../components/Token';

function BasicMarketTokenIcon({
  uri,
  uris,
  size,
  networkId,
}: {
  uri: string;
  uris?: string[];
  size: ITokenProps['size'];
  networkId?: string;
}) {
  return (
    <Token
      size={size}
      tokenImageUri={uri}
      tokenImageUris={uris}
      networkId={networkId}
      showNetworkIcon={Boolean(networkId)}
    />
  );
}

export const MarketTokenIcon = memo(BasicMarketTokenIcon);
