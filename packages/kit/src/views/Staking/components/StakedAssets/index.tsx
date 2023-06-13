import type { FC } from 'react';

import { Box } from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../../../hooks';
import { isSupportStakedAssets } from '../../utils';

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
  const statedSupport = isSupportStakedAssets(networkId, tokenIdOnNetwork);
  if (networkId && statedSupport) {
    children = <ETHAsset networkId={networkId} accountId={accountId} />;
  }
  return children ? <Box mt="24px">{children}</Box> : null;
};

export default StakedAssets;
