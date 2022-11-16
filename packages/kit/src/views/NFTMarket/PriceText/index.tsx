import React, { ComponentProps, FC } from 'react';

import { Text } from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';

export const floorPriceSymbolMap: Record<string, string> = {
  [OnekeyNetwork.eth]: 'ETH',
  [OnekeyNetwork.optimism]: 'ETH',
  [OnekeyNetwork.bsc]: 'BNB',
  [OnekeyNetwork.polygon]: 'MATIC',
  [OnekeyNetwork.arbitrum]: 'ETH',
  [OnekeyNetwork.sol]: 'SOL',
  [OnekeyNetwork.avalanche]: 'AVAX',
};
type Props = {
  prefix?: string;
  price?: number | string | null;
  symbol?: string;
  networkId?: string;
} & ComponentProps<typeof Text>;

const PriceText: FC<Props> = ({
  prefix = '',
  price,
  networkId,
  symbol,
  ...textProps
}) => {
  const innderSymbol = symbol ?? floorPriceSymbolMap[networkId ?? ''];
  let value = '–';
  if (price && price !== null) {
    value = `${price} ${innderSymbol ?? ''}`;
  }
  return <Text {...textProps}>{`${prefix} ${value}`}</Text>;
};

export function PriceString({ prefix = '', price, networkId, symbol }: Props) {
  const innderSymbol = symbol ?? floorPriceSymbolMap[networkId ?? ''];
  let value = '–';
  if (price && price !== null) {
    value = `${price} ${innderSymbol ?? ''}`;
  }
  return `${`${prefix} `}${value}`;
}
export default PriceText;
