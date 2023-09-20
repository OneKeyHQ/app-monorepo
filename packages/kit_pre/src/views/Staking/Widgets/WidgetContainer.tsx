import { type FC } from 'react';

import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import { useActiveWalletAccount } from '../../../hooks';
import { isAccountCompatibleWithStakingTypes } from '../utils';

type WidgetContainerProps = {
  stakingType: string;
};

export const WidgetContainer: FC<WidgetContainerProps> = ({
  stakingType,
  children,
}) => {
  const { accountId, networkId } = useActiveWalletAccount();
  if (
    isAllNetworks(networkId) ||
    isAccountCompatibleWithStakingTypes(accountId, stakingType)
  ) {
    return <>{children}</>;
  }
  return null;
};
