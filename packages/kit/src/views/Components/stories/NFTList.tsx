import React from 'react';

import { Center, Typography } from '@onekeyhq/components';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import Collectibles from '../../Wallet/Collectibles';

const TypographyGallery = () => {
  console.log();
  const { account, network } = useActiveWalletAccount();

  return (
    <Center flex={1}>
      <Collectibles address={account?.address} network={network} />
    </Center>
  );
};

export default TypographyGallery;
