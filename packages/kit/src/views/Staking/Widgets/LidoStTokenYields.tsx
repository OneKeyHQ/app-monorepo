import { useCallback, useMemo } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Typography } from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../hooks';
import { useAllNetworksSelectNetworkAccount } from '../../../hooks/useAllNetwoks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { formatAmount } from '../../../utils/priceUtils';
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
  const { accountId, networkId } = useActiveWalletAccount();
  const ethStakingApr = useAppSelector((s) => s.staking.ethStakingApr);
  const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
    accountId,
    networkId,
    filter: getStakeSelectNetworkAccountFilter(stakingType),
  });
  const lidoApr = useMemo(() => {
    if (!ethStakingApr) return undefined;
    const items =
      networkId === OnekeyNetwork.eth
        ? ethStakingApr.mainnet
        : ethStakingApr.testnet;
    return `${formatAmount(items.lido, 2)}%`;
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
          {intl.formatMessage({ id: 'content__up_to_apy' }, { '0': lidoApr })}
        </Typography.Body2>
      </Box>
    </Pressable>
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
