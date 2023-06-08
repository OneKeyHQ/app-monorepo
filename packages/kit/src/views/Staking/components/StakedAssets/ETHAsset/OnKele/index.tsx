import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Icon,
  Image,
  Pressable,
  Spinner,
  Stack,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import KeleLogoPNG from '@onekeyhq/kit/assets/staking/kele_pool.png';

import backgroundApiProxy from '../../../../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../../../routes/routesEnum';
import { multiply, plus } from '../../../../../Swap/utils';
import { useAccountStakingActivity } from '../../../../hooks';
import { StakingRoutes } from '../../../../typing';

import type { KeleMinerOverview } from '../../../../typing';

type ButtonProps = Exclude<ComponentProps<typeof Button>, 'onPress'>;

const StakingButton: FC<ButtonProps> = ({ ...rest }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { networkId, wallet } = useActiveWalletAccount();

  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.StakingAmount,
        params: {
          networkId,
        },
      },
    });
  }, [navigation, networkId]);
  return (
    <Button
      {...rest}
      onPress={onPress}
      isDisabled={wallet?.type === 'watching'}
    >
      {intl.formatMessage({ id: 'action__stake' })}
    </Button>
  );
};

const UnstakingButton: FC<ButtonProps> = ({ ...rest }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { networkId, wallet } = useActiveWalletAccount();
  const enableETH2Unstake = useAppSelector((s) => s.settings.enableETH2Unstake);

  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.KeleEthUnstakeShouldUnderstand,
        params: {
          networkId,
        },
      },
    });
  }, [navigation, networkId]);
  return (
    <Button
      {...rest}
      onPress={onPress}
      isDisabled={wallet?.type === 'watching' || !enableETH2Unstake}
    >
      {intl.formatMessage({ id: 'action__unstake' })}
    </Button>
  );
};

function NoAssetsOnKele() {
  const intl = useIntl();
  const { themeVariant } = useTheme();
  const keleDashboardGlobal = useAppSelector(
    (s) => s.staking.keleDashboardGlobal,
  );
  const apr = useMemo(() => {
    if (!keleDashboardGlobal) {
      return '4.12';
    }
    return multiply(
      plus(
        keleDashboardGlobal.apr_detail.basic,
        keleDashboardGlobal.apr_detail.mev,
      ),
      100,
    );
  }, [keleDashboardGlobal]);

  return (
    <Box
      borderRadius={12}
      bg="surface-default"
      p="4"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      borderWidth={themeVariant === 'light' ? 1 : 0}
      borderColor="border-subdued"
    >
      <Box flexDirection="row" alignItems="center" flex={1}>
        <Center w="8" h="8" bg="interactive-default" mr="3" borderRadius="full">
          <Icon name="DatabaseMini" color="icon-on-primary" />
        </Center>
        <Box mr="4" flex={1}>
          <Typography.Body1Strong>
            {intl.formatMessage({ id: 'form__stake_earn' })}
          </Typography.Body1Strong>
          <Typography.Caption color="text-subdued">
            {intl.formatMessage(
              { id: 'form__stake_earn_desc' },
              { '0': `${apr}%` },
            )}
          </Typography.Caption>
        </Box>
      </Box>
      <StakingButton />
    </Box>
  );
}

type StakingAssetOnKeleProps = {
  state?: KeleMinerOverview;
  networkId: string;
  accountId: string;
};

export const AssetStakedOnKele: FC<StakingAssetOnKeleProps> = ({
  state,
  networkId,
  accountId,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const activeStakingActivity = useAccountStakingActivity(networkId, accountId);

  useEffect(() => {
    async function main() {
      if (activeStakingActivity) {
        if (activeStakingActivity.nonce === undefined) {
          backgroundApiProxy.serviceStaking.setAccountStakingActivity({
            networkId,
            accountId,
            data: undefined,
          });
          return;
        }
        const status =
          await backgroundApiProxy.serviceHistory.queryTransactionNonceStatus({
            networkId,
            accountId,
            nonce: activeStakingActivity.nonce,
          });
        if (status === 'pending') {
          return;
        }
        if (status === 'canceled' || status === 'failed') {
          backgroundApiProxy.serviceStaking.setAccountStakingActivity({
            networkId,
            accountId,
            data: undefined,
          });
          return;
        }
        const minerOverview =
          await backgroundApiProxy.serviceStaking.fetchMinerOverview({
            networkId,
            accountId,
          });
        if (minerOverview) {
          if (
            minerOverview.amount.total_amount &&
            minerOverview.amount.total_amount >
              Number(activeStakingActivity.oldValue ?? 0)
          ) {
            backgroundApiProxy.serviceStaking.setAccountStakingActivity({
              networkId,
              accountId,
              data: undefined,
            });
          }
        }
      }
    }
    if (activeStakingActivity) {
      const createdAt = activeStakingActivity.createdAt ?? 0;
      if (!createdAt || Date.now() - createdAt > 60 * 60 * 1000) {
        backgroundApiProxy.serviceStaking.setAccountStakingActivity({
          networkId,
          accountId,
          data: undefined,
        });
      } else {
        main();
        const timer = setInterval(main, 30 * 1000);
        return () => clearInterval(timer);
      }
    }
  }, [activeStakingActivity, networkId, accountId]);

  const onDetail = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.StakedETHOnKele,
        params: {
          networkId,
        },
      },
    });
  }, [navigation, networkId]);
  return (
    <Box borderRadius={12} bg="surface-default" flexDirection="row" p="4">
      <Box mr="3">
        <Image w="8" h="8" source={KeleLogoPNG} />
      </Box>
      <Box flex="1">
        <Box>
          <Typography.Body1Strong>
            {intl.formatMessage(
              { id: 'title__staked_on_str' },
              { '0': 'kelepool' },
            )}
          </Typography.Body1Strong>
          {activeStakingActivity ? (
            <Box flexDirection="row" alignItems="center">
              <Spinner size="sm" />
              <Typography.Body2 ml="2" color="text-subdued">
                {intl.formatMessage(
                  { id: 'title__staking_in_process' },
                  { '0': '5' },
                )}
              </Typography.Body2>
            </Box>
          ) : (
            <Typography.Body2 color="text-subdued">{`${
              state?.amount.total_amount ?? '0'
            } ETH`}</Typography.Body2>
          )}
        </Box>
        <Box justifyContent="space-between" flexDirection="row" mt="4">
          <Box>
            {activeStakingActivity ? null : (
              <Pressable
                flexDirection="row"
                alignItems="center"
                onPress={onDetail}
              >
                <Typography.Body2 color="text-subdued">
                  {intl.formatMessage({ id: 'content__details' })}
                </Typography.Body2>
                <Icon name="ChevronRightOutline" size={16} />
              </Pressable>
            )}
          </Box>

          <Stack direction="row" space={4}>
            <UnstakingButton size="sm" />
            <StakingButton size="sm" type="primary" />
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

type ETHAssetOnKeleProps = {
  networkId: string;
  accountId: string;
};

const ETHAssetOnKele: FC<ETHAssetOnKeleProps> = () => <NoAssetsOnKele />;

// const ETHAssetOnKele: FC<ETHAssetOnKeleProps> = ({ networkId, accountId }) => {
//   const minerOverview = useKeleMinerOverview(networkId, accountId);
//   const activeStakingActivity = useAccountStakingActivity(networkId, accountId);
//   useEffect(() => {
//     backgroundApiProxy.serviceStaking.fetchMinerOverview({
//       accountId,
//       networkId,
//     });
//   }, [accountId, networkId]);
//   return (minerOverview &&
//     minerOverview.amount.total_amount &&
//     minerOverview.amount.total_amount > 0) ||
//     activeStakingActivity ? (
//     <AssetStakedOnKele
//       state={minerOverview}
//       networkId={networkId}
//       accountId={accountId}
//     />
//   ) : (
//     <NoAssetsOnKele />
//   );
// };

export default ETHAssetOnKele;
