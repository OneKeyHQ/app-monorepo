import type { FC } from 'react';

import { Box } from '@onekeyhq/components';
import { useTokenSupportStakedAssets } from '@onekeyhq/kit/src/hooks/useTokens';

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
  const statedSupport = useTokenSupportStakedAssets(
    networkId,
    tokenIdOnNetwork,
  );
  if (networkId && statedSupport) {
    children = <ETHAsset networkId={networkId} accountId={accountId} />;
  }
  return children ? <Box mb="4">{children}</Box> : null;
};

export default StakedAssets;
