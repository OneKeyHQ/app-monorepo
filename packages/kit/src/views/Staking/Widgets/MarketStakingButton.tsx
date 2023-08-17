import { type FC, useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { useActiveWalletAccount } from '../../../hooks';
import { useAllNetworksSelectNetworkAccount } from '../../../hooks/useAllNetwoks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { ButtonItem } from '../../TokenDetail/TokenDetailHeader/ButtonItem';
import { StakingRoutes } from '../typing';
import {
  StakingTypes,
  getStakeSelectNetworkAccountFilter,
  isAccountCompatibleWithStakingTypes,
} from '../utils';

import { WidgetContainer } from './WidgetContainer';

type MarketStakeButtonContentProps = {
  stakingType: string;
  buttonType?: 'icon' | 'text';
};

const getStakingRoute = (stakingType: string) => {
  if (stakingType === StakingTypes.eth) {
    return StakingRoutes.ETHStake;
  }
  if (stakingType === StakingTypes.matic) {
    return StakingRoutes.MaticStake;
  }
  throw new Error('wrong stake type params');
};

export const MarketStakeButtonContent: FC<MarketStakeButtonContentProps> = ({
  stakingType,
  buttonType = 'icon',
}) => {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const { accountId, networkId } = useActiveWalletAccount();
  const navigation = useNavigation();
  const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
    accountId,
    networkId,
    filter: getStakeSelectNetworkAccountFilter(stakingType),
  });
  const onPress = useCallback(async () => {
    try {
      setLoading(true);
      const { account, network } = await selectNetworkAccount();
      debugLogger.staking.info(
        `use networkId: ${network.id} and account id ${account.id} to stake asset`,
      );
      const screen = getStakingRoute(stakingType);
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Staking,
        params: {
          screen,
          params: {
            networkId: network.id,
            accountId: account.id,
          },
        },
      });
    } finally {
      setLoading(false);
    }
  }, [selectNetworkAccount, navigation, stakingType]);
  return stakingType && !loading ? (
    <>
      {buttonType === 'icon' ? (
        <ButtonItem
          icon="InboxArrowDownMini"
          text={intl.formatMessage({ id: 'action__stake' })}
          onPress={onPress}
        />
      ) : (
        <Button borderRadius={12} type="basic" size="xs" onPress={onPress}>
          {intl.formatMessage({ id: 'action__stake' })}
        </Button>
      )}
    </>
  ) : null;
};

type MarketStakeButtonProps = {
  stakingType: string;
  buttonType?: 'icon' | 'text';
};

export const MarketStakeButton: FC<MarketStakeButtonProps> = ({
  stakingType,
  buttonType,
}) => {
  const { accountId, networkId } = useActiveWalletAccount();
  if (
    isAllNetworks(networkId) ||
    isAccountCompatibleWithStakingTypes(accountId, stakingType)
  ) {
    return (
      <WidgetContainer stakingType={stakingType}>
        <MarketStakeButtonContent
          stakingType={stakingType}
          buttonType={buttonType}
        />
      </WidgetContainer>
    );
  }
  return null;
};
