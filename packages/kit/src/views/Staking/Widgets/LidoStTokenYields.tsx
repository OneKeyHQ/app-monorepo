import { useCallback, useEffect, useMemo } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Image,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { formatAmount } from '../../../utils/priceUtils';
import { useAllNetworksSelectNetworkAccount } from '../../ManageNetworks/hooks';
import { Options } from '../components/EthereumUtilsComponent';
import { StakingRoutes } from '../typing';
import {
  StakingTypes,
  getStakeSelectNetworkAccountFilter,
  isSTETH,
} from '../utils';

import { WidgetContainer } from './WidgetContainer';

type LidoStTokenYieldsContentProps = {
  stakingType: string;
};

const LidoStTokenYieldsContent: FC<LidoStTokenYieldsContentProps> = ({
  stakingType,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { accountId, walletId, networkId } = useActiveWalletAccount();
  const ethStakingApr = useAppSelector((s) => s.staking.ethStakingApr);
  const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
    accountId,
    walletId,
    networkId,
    filter: getStakeSelectNetworkAccountFilter(stakingType),
  });
  const lidoApr = useMemo(() => {
    if (!ethStakingApr) return undefined;
    const items =
      networkId === OnekeyNetwork.eth
        ? ethStakingApr.mainnet
        : ethStakingApr.testnet;
    return {
      name: 'Lido • Ethereum',
      value: `${formatAmount(items.lido, 2)}%`,
      logo: require('@onekeyhq/kit/assets/staking/lido_pool.png'),
    };
  }, [ethStakingApr, networkId]);

  const onPress = useCallback(async () => {
    const { account, network } = await selectNetworkAccount();
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.LidoEthStakeShouldUnderstand,
        params: {
          networkId: network.id,
          accountId: account.id,
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
          {intl.formatMessage({ id: 'form__related_pool' })}
        </Typography.Heading>
        <Box />
      </Box>
      {lidoApr ? (
        <Options
          title="ETH"
          subtitle={lidoApr.name}
          num={lidoApr.value}
          logo={lidoApr.logo}
          onPress={onPress}
        />
      ) : null}
      <Box py="1">
        <Typography.Body2 color="text-subdued">
          {intl.formatMessage(
            {
              id: 'content__when_you_stake_str_you_receive_str',
            },
            { '0': 'ETH', '1': 'stETH' },
          )}
        </Typography.Body2>
      </Box>
    </Box>
  );
};

export const LidoStTokenYields: FC<{ token?: Token }> = ({ token }) => {
  const stETH = isSTETH(token?.networkId, token?.tokenIdOnNetwork);
  return stETH ? (
    <WidgetContainer stakingType={StakingTypes.eth}>
      <LidoStTokenYieldsContent stakingType={StakingTypes.eth} />
    </WidgetContainer>
  ) : null;
};
