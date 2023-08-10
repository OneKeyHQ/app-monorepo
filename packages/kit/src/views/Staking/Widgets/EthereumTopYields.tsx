import { useCallback, useEffect, useMemo } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Pressable, Typography } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../hooks';
import { useAllNetworksSelectNetworkAccount } from '../../../hooks/useAllNetwoks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { formatAmount } from '../../../utils/priceUtils';
import { EthStakingSource, StakingRoutes } from '../typing';
import {
  StakingTypes,
  getStakeSelectNetworkAccountFilter,
  isSupportStakingType,
} from '../utils';

import { WidgetContainer } from './WidgetContainer';

type EthereumTopYieldsContentProps = {
  stakingType: string;
};
const EthereumTopYieldsContent: FC<EthereumTopYieldsContentProps> = ({
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

  useEffect(() => {
    backgroundApiProxy.serviceStaking.fetchEthAprSma();
  }, []);

  const ethStakingApr = useAppSelector((s) => s.staking.ethStakingApr);

  const topApr = useMemo(() => {
    if (!ethStakingApr) return undefined;
    const items =
      networkId === OnekeyNetwork.eth
        ? ethStakingApr.mainnet
        : ethStakingApr.testnet;
    return items.kele > items.lido
      ? {
          name: 'Kele • Ethereum',
          value: `${formatAmount(items.kele, 2)}%`,
          logo: require('@onekeyhq/kit/assets/staking/kele_pool.png'),
        }
      : {
          name: 'Lido • Ethereum',
          value: `${formatAmount(items.lido, 2)}%`,
          logo: require('@onekeyhq/kit/assets/staking/lido_pool.png'),
        };
  }, [ethStakingApr, networkId]);

  const onSelect = useCallback(
    async (source?: EthStakingSource) => {
      const { account, network } = await selectNetworkAccount();
      if (source === EthStakingSource.Kele) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Staking,
          params: {
            screen: StakingRoutes.StakedETHOnKele,
            params: {
              accountId: account.id,
              networkId: network.id,
            },
          },
        });
      } else {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Staking,
          params: {
            screen: StakingRoutes.StakedETHOnLido,
            params: {
              accountId: account.id,
              networkId: network.id,
            },
          },
        });
      }
    },
    [navigation, selectNetworkAccount],
  );

  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.ETHPoolSelector,
        params: {
          networkId,
          accountId,
          onSelector: onSelect,
        },
      },
    });
  }, [navigation, networkId, accountId, onSelect]);

  if (!topApr) {
    return null;
  }

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
          {intl.formatMessage({ id: 'title__stake_str' }, { '0': 'ETH' })}
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

export const EthereumTopYields: FC<{ token?: Token }> = ({ token }) => {
  const stakingType = isSupportStakingType({
    networkId: token?.networkId,
    tokenIdOnNetwork: token?.tokenIdOnNetwork,
  });
  return stakingType === StakingTypes.eth ? (
    <WidgetContainer stakingType={stakingType}>
      <EthereumTopYieldsContent stakingType={stakingType} />
    </WidgetContainer>
  ) : null;
};
