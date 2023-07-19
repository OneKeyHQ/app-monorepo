import type { FC } from 'react';

import { HStack, Text, Token } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

const HeaderDescription: FC<{ network?: Network | null }> = ({ network }) => {
  if (!network) return null;

  return (
    <HStack space="6px">
      <Token
        size={4}
        token={{
          logoURI: network.logoURI,
        }}
      />
      <Text typography="Caption" color="text-subdued">{`Bitcoin${
        network.id === OnekeyNetwork.tbtc ? ' Testnet' : ''
      }`}</Text>
    </HStack>
  );
};

export default HeaderDescription;
