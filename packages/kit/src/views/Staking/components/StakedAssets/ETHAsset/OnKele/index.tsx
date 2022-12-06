import React, { ComponentProps, FC, useCallback, useEffect } from 'react';

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
import { useActiveWalletAccount, useNavigation } from '../../../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../../../routes/types';
import {
  useAccountStakingActivity,
  useKelePoolStakingState,
} from '../../../../hooks';
import { KeleETHStakingState, StakingRoutes } from '../../../../typing';

type StakingButtonProps = Exclude<ComponentProps<typeof Button>, 'onPress'>;

const StakingButton: FC<StakingButtonProps> = ({ ...rest }) => {
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

function NoAssetsOnKele() {
  const intl = useIntl();
  const { themeVariant } = useTheme();

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
              { '0': '4.12%' },
            )}
          </Typography.Caption>
        </Box>
      </Box>
      <StakingButton />
    </Box>
  );
}

type StakingAssetOnKeleProps = {
  state?: KeleETHStakingState;
  networkId: string;
  accountId: string;
};

const AssetStakedOnKele: FC<StakingAssetOnKeleProps> = ({
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
        const stateOnKele =
          await backgroundApiProxy.serviceStaking.fetchStakedStateOnKele({
            networkId,
            accountId,
          });
        if (stateOnKele) {
          if (
            stateOnKele.total &&
            stateOnKele.total > Number(activeStakingActivity.oldValue ?? 0)
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
              state?.total ?? '0'
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
            <Button size="sm" isDisabled>
              {intl.formatMessage({ id: 'action__unstake' })}
            </Button>
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

const ETHAssetOnKele: FC<ETHAssetOnKeleProps> = ({ networkId, accountId }) => {
  const stakingState = useKelePoolStakingState(networkId, accountId);
  const activeStakingActivity = useAccountStakingActivity(networkId, accountId);
  useEffect(() => {
    backgroundApiProxy.serviceStaking.fetchStakedStateOnKele({
      accountId,
      networkId,
    });
  }, [accountId, networkId]);
  return (stakingState && stakingState.total && stakingState.total > 0) ||
    activeStakingActivity ? (
    <AssetStakedOnKele
      state={stakingState}
      networkId={networkId}
      accountId={accountId}
    />
  ) : (
    <NoAssetsOnKele />
  );
};

export default ETHAssetOnKele;
