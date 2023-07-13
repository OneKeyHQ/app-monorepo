import { type FC, useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import { Box, IconButton } from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { useActiveWalletAccount } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { useAllNetworksSelectNetworkAccount } from '../../ManageNetworks/hooks';
import { StakingRoutes } from '../typing';
import {
  getStakeSelectNetworkAccountFilter,
  isAccountCompatibleWithStakingTypes,
} from '../utils';

import { WidgetContainer } from './WidgetContainer';

type MarketStakeButtonContentProps = {
  stakingType: string;
};

export const MarketStakeButtonContent: FC<MarketStakeButtonContentProps> = ({
  stakingType,
}) => {
  const [loading, setLoading] = useState(false);
  const { accountId, walletId, networkId } = useActiveWalletAccount();
  const navigation = useNavigation();
  const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
    accountId,
    networkId,
    walletId,
    filter: getStakeSelectNetworkAccountFilter(stakingType),
  });
  const onPress = useCallback(async () => {
    try {
      setLoading(true);
      const { account, network } = await selectNetworkAccount();
      debugLogger.staking.info(
        `use networkId: ${network.id} and account id ${account.id} to stake asset`,
      );
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Staking,
        params: {
          screen: StakingRoutes.ETHStake,
          params: {
            networkId: network.id,
            accountId: account.id,
          },
        },
      });
    } finally {
      setLoading(false);
    }
  }, [selectNetworkAccount, navigation]);
  return stakingType ? (
    <Box>
      <IconButton
        isLoading={loading}
        ml={4}
        type="basic"
        name="InboxArrowDownMini"
        size="base"
        circle
        iconColor="icon-default"
        onPress={onPress}
      />
    </Box>
  ) : null;
};

type MarketStakeButtonProps = {
  stakingType: string;
};

export const MarketStakeButton: FC<MarketStakeButtonProps> = ({
  stakingType,
}) => {
  const { accountId, networkId } = useActiveWalletAccount();
  if (
    isAllNetworks(networkId) ||
    isAccountCompatibleWithStakingTypes(accountId, stakingType)
  ) {
    return (
      <WidgetContainer stakingType={stakingType}>
        <MarketStakeButtonContent stakingType={stakingType} />
      </WidgetContainer>
    );
  }
  return null;
};
