import React from 'react';

import { Center } from '@onekeyhq/components';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import Collectibles from '../../Wallet/Collectibles';

const NFTListGallery = () => {
  console.log();
  const { account, network } = useActiveWalletAccount();

  return (
    <Center flex={1}>
      <Collectibles address={account?.address} network={network} />
    </Center>
  );
};

export default NFTListGallery;
