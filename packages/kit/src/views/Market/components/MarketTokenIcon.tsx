import { memo } from 'react';

import { Token } from '../../../components/Token';

import type { ITokenProps } from '../../../components/Token';

function BasicMarketTokenIcon({
  uri,
  size,
}: {
  uri: string;
  size: ITokenProps['size'];
}) {
  return <Token size={size} tokenImageUri={uri} />;
}

export const MarketTokenIcon = memo(BasicMarketTokenIcon);
