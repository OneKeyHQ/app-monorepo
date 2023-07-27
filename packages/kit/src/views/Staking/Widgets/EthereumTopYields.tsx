import { useCallback, useEffect, useMemo } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Button, Typography } from '@onekeyhq/components';
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
import { Options } from '../components/EthereumUtilsComponent';
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
    if (!topApr) {
      return;
    }
    if (topApr.name === 'Kele • Ethereum') {
      onSelect(EthStakingSource.Kele);
    } else {
      onSelect(EthStakingSource.Lido);
    }
  }, [topApr, onSelect]);

  const onViewAll = useCallback(() => {
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
        <Button
          type="plain"
          size="sm"
          pr="0"
          rightIconName="ChevronRightMini"
          onPress={onViewAll}
        >
          {intl.formatMessage({ id: 'action__view_all' })}
        </Button>
      </Box>
      <Options
        title="ETH"
        subtitle={topApr.name}
        num={topApr.value}
        logo={topApr.logo}
        onPress={onPress}
      />
    </Box>
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
