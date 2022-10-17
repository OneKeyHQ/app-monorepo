import React, { FC } from 'react';

import { Box } from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';

import { useActiveWalletAccount } from '../../../../hooks';

import ETHAsset from './ETHAsset';

type StakedAssetsProps = {
  networkId?: string;
  tokenIdOnNetwork?: string;
};

const StakedAssets: FC<StakedAssetsProps> = ({
  networkId,
  tokenIdOnNetwork,
}) => {
  const { accountId } = useActiveWalletAccount();
  let children: JSX.Element | undefined;
  if (networkId === OnekeyNetwork.eth && !tokenIdOnNetwork) {
    children = <ETHAsset networkId={networkId} accountId={accountId} />;
  }
  if (networkId === OnekeyNetwork.goerli && !tokenIdOnNetwork) {
    children = <ETHAsset networkId={networkId} accountId={accountId} />;
  }
  return children ? <Box mb="4">{children}</Box> : null;
};

export default StakedAssets;
