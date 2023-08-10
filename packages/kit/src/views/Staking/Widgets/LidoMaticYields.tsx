import { useCallback } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Typography } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { useActiveWalletAccount, useNavigation } from '../../../hooks';
import { useAllNetworksSelectNetworkAccount } from '../../../hooks/useAllNetwoks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { Options } from '../components/EthereumUtilsComponent';
import { StakingRoutes } from '../typing';
import {
  StakingTypes,
  getStakeSelectNetworkAccountFilter,
  isSupportStakingType,
} from '../utils';

import { WidgetContainer } from './WidgetContainer';

type LidoMaticYieldsContentProps = {
  stakingType: string;
};
const LidoMaticYieldsContent: FC<LidoMaticYieldsContentProps> = ({
  stakingType,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { accountId, networkId } = useActiveWalletAccount();

  const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
    accountId,
    networkId,
    filter: getStakeSelectNetworkAccountFilter(stakingType),
  });

  const topApr = {
    name: 'Lido • Matic',
    value: `4.3 %`,
    logo: require('@onekeyhq/kit/assets/staking/lido_pool.png'),
  };

  const onPress = useCallback(async () => {
    const { account, network } = await selectNetworkAccount();
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.StakedMaticOnLido,
        params: {
          accountId: account.id,
          networkId: network.id,
        },
      },
    });
  }, [navigation, selectNetworkAccount]);

  return (
    <Box>
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        h="16"
      >
        <Typography.Heading>
          {intl.formatMessage({ id: 'form__top_yields' })}
        </Typography.Heading>
      </Box>
      <Options
        title="MATIC"
        source={require('@onekeyhq/kit/assets/staking/matic_logo.png')}
        subtitle={topApr.name}
        num={topApr.value}
        logo={topApr.logo}
        onPress={onPress}
      />
    </Box>
  );
};

export const LidoMaticYields: FC<{ token?: Token }> = ({ token }) => {
  const stakingType = isSupportStakingType({
    networkId: token?.networkId,
    tokenIdOnNetwork: token?.tokenIdOnNetwork,
  });
  return stakingType === StakingTypes.matic ? (
    <WidgetContainer stakingType={stakingType}>
      <LidoMaticYieldsContent stakingType={stakingType} />
    </WidgetContainer>
  ) : null;
};
