import { useCallback } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Pressable, Typography } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { useActiveWalletAccount, useNavigation } from '../../../hooks';
import { useAllNetworksSelectNetworkAccount } from '../../../hooks/useAllNetwoks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
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
    <Pressable onPress={onPress}>
      <Box
        w="full"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        bg="surface-default"
        py="3"
        px="4"
        borderRadius={12}
        borderWidth="1"
        borderColor="border-subdued"
      >
        <Typography.Body2Strong>
          {intl.formatMessage({ id: 'title__stake_str' }, { '0': 'MATIC' })}
        </Typography.Body2Strong>
        <Typography.Body2 color="text-subdued">
          {intl.formatMessage(
            { id: 'content__up_to_apy' },
            { '0': topApr.value },
          )}
        </Typography.Body2>
      </Box>
    </Pressable>
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
