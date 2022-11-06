import React, { ComponentProps, FC } from 'react';

import { Text } from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';

export const floorPriceSymbolMap: Record<string, string> = {
  [OnekeyNetwork.eth]: 'ETH',
  [OnekeyNetwork.optimism]: 'AVAX',
  [OnekeyNetwork.bsc]: 'BNB',
  [OnekeyNetwork.polygon]: 'MATIC',
  [OnekeyNetwork.arbitrum]: 'ETH',
  [OnekeyNetwork.sol]: 'SOL',
  [OnekeyNetwork.avalanche]: 'ETH',
};
type Props = {
  prefix?: string;
  price?: number | string | null;
  networkId?: string;
} & ComponentProps<typeof Text>;

const PriceText: FC<Props> = ({
  prefix = '',
  price = 0,
  networkId,
  ...textProps
}) => {
  const symbol = floorPriceSymbolMap[networkId ?? ''];
  return (
    <Text {...textProps}>{`${prefix} ${price ?? 0} ${symbol ?? ''}`}</Text>
  );
};

export function PriceString({ prefix = '', price = 0, networkId }: Props) {
  const symbol = floorPriceSymbolMap[networkId ?? ''];
  return `${prefix} ${price ?? 0} ${symbol ?? ''}`;
}
export default PriceText;
