import React, { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { format as dateFormat } from 'date-fns';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Alert,
  Box,
  Button,
  Center,
  Divider,
  Empty,
  Icon,
  Image,
  Modal,
  Skeleton,
  Stack,
  Typography,
} from '@onekeyhq/components';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import EthLogo from '../../../../assets/staking/eth_logo.png';
import KeleLogoPNG from '../../../../assets/staking/kele_pool.png';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatCurrency } from '../../../components/Format';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNetworkTokensPrice,
} from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { useAccountStakingActivity, useKelePoolStakingState } from '../hooks';
import { StakingRoutes, StakingRoutesParams } from '../typing';

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

type IncomeItem = {
  date: string;
  reward: number;
  deposit?: number;
  balance: number;
};

const ListHeaderComponent = () => {
  const intl = useIntl();
  const { wallet, networkId, accountId } = useActiveWalletAccount();
  const stakingState = useKelePoolStakingState(networkId, accountId);
  const activeStakingActivity = useAccountStakingActivity(networkId, accountId);
  const navigation = useNavigation<NavigationProps['navigation']>();
  const prices = useNetworkTokensPrice(networkId);
  const showETH2UnableToUnstakeWarning = useAppSelector(
    (s) => s.staking.showETH2UnableToUnstakeWarning,
  );
  const keleDashboardGlobal = useAppSelector(
    (s) => s.staking.keleDashboardGlobal,
  );
  const onStake = useCallback(() => {
    navigation.replace(RootRoutes.Modal, {
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
    <Box>
      <Center>
        <Image w="16" h="16" source={EthLogo} />
        <Box mt="2">
          {stakingState?.total ? (
            <Typography.DisplayLarge>{`${stakingState.total} ETH`}</Typography.DisplayLarge>
          ) : (
            <Skeleton shape="DisplayLarge" />
          )}
        </Box>
        <FormatCurrency
          numbers={[prices.main ?? 0, stakingState?.total ?? 0]}
          render={(ele) => (
            <Typography.Body1 ml={3} color="text-subdued">
              {prices.main ? ele : '-'}
            </Typography.Body1>
          )}
        />
        <Stack direction="row" space="2" my="6">
          <Button leftIconName="MinusCircleMini" isDisabled>
            {intl.formatMessage({ id: 'action__unstake' })}
          </Button>
          <Button
            isDisabled={wallet?.type === 'watching'}
            isLoading={!!activeStakingActivity}
            leftIconName="InboxArrowDownMini"
            onPress={onStake}
          >
            {intl.formatMessage({ id: 'action__stake' })}
          </Button>
        </Stack>
      </Center>
      {showETH2UnableToUnstakeWarning ? (
        <Alert
          alertType="info"
          title={intl.formatMessage({
            id: 'content__when_can_i_get_my_staked_eth_back',
          })}
          description={intl.formatMessage({
            id: 'content__staked_eth_can_t_be_taken_back_now_desc',
          })}
          onDismiss={() =>
            backgroundApiProxy.serviceStaking.hideETH2UnableToUnstakeWarning()
          }
        />
      ) : null}
      <Box
        borderRadius={12}
        bg="surface-default"
        flexDirection="row"
        p="4"
        mt="6"
        mb="4"
      >
        <Image w="10" h="10" source={KeleLogoPNG} mr="4" />
        <Box>
          <Box flexDirection="row">
            <Typography.Body1>Kele Pool ・</Typography.Body1>
            <Typography.Body1 color="text-success">4.12% APY</Typography.Body1>
          </Box>
          <Typography.Body2 color="text-subdued">
            {intl.formatMessage({ id: 'content__third_party_validator' })}
          </Typography.Body2>
        </Box>
      </Box>
      {stakingState?.staking ? (
        <Box
          p="4"
          borderRadius={12}
          bg="surface-default"
          flexDirection="row"
          alignItems="center"
        >
          <Center
            w="10"
            h="10"
            bg="surface-neutral-default"
            borderRadius="full"
            mr="2"
          >
            <Icon name="InboxArrowDownMini" size={16} />
          </Center>
          <Box flex="1">
            <Typography.Body1>
              {intl.formatMessage(
                { id: 'form__str_is_activating' },
                { '0': `${stakingState.staking} ETH` },
              )}
            </Typography.Body1>
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage(
                { id: 'form__str_is_activating_eth_desc' },
                {
                  '0': 'ETH',
                  '1':
                    keleDashboardGlobal?.validator_alive_predicted_hour ?? '24',
                  '3': `${(
                    keleDashboardGlobal?.retail_deposit_far ?? 32
                  ).toFixed(2)} ETH`,
                },
              )}
            </Typography.Body2>
          </Box>
        </Box>
      ) : null}
      <Box my="2">
        <Typography.Heading>
          {intl.formatMessage({ id: 'form__reward_history' })}
        </Typography.Heading>
      </Box>
    </Box>
  );
};

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Box py="10">
      <Empty
        emoji="🕐"
        title={intl.formatMessage({ id: 'transaction__history_empty_title' })}
        subTitle={intl.formatMessage({ id: 'reward__history_empty_desc' })}
      />
    </Box>
  );
};

export default function StakedETHOnKele() {
  const intl = useIntl();
  const { networkId, accountId } = useActiveWalletAccount();
  const prices = useNetworkTokensPrice(networkId);
  const [incomeItems, setIncomeItems] = useState<IncomeItem[]>([]);
  useEffect(() => {
    async function loadData() {
      backgroundApiProxy.serviceStaking.fetchStakedStateOnKele({
        accountId,
        networkId,
      });
      const data =
        await backgroundApiProxy.serviceStaking.getStakingIncomeHistoryOnKele({
          accountId,
          networkId,
        });
      if (data) {
        setIncomeItems(data);
      }
      await backgroundApiProxy.serviceStaking.getDashboardGlobal({ networkId });
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const renderItem: ListRenderItem<IncomeItem> = useCallback(
    ({ item, index }) => (
      <Box
        py="4"
        px="6"
        bg="surface-default"
        borderTopRadius={index === 0 ? 12 : undefined}
        borderBottomRadius={index === incomeItems.length - 1 ? 12 : undefined}
      >
        <Box justifyContent="space-between" flexDirection="row" mb="1">
          <Typography.Body1Strong>
            {intl.formatMessage({ id: 'form__staking_reward' })}
          </Typography.Body1Strong>
          <Typography.Body1Strong>+{item.reward} ETH</Typography.Body1Strong>
        </Box>
        <Box justifyContent="space-between" flexDirection="row">
          <Typography.Body2 color="text-subdued">
            {dateFormat(new Date(item.date), 'LLL dd yyyy')}
          </Typography.Body2>
          <FormatCurrency
            numbers={[prices.main ?? 0, item.reward ?? 0]}
            render={(ele) => (
              <Typography.Body2 ml={3} color="text-subdued">
                {prices.main ? ele : '-'}
              </Typography.Body2>
            )}
          />
        </Box>
      </Box>
    ),
    [incomeItems.length, intl, prices],
  );
  return (
    <Modal
      height="560px"
      footer={null}
      flatListProps={{
        data: incomeItems,
        // @ts-ignore
        renderItem,
        ListHeaderComponent,
        ListEmptyComponent,
        ItemSeparatorComponent: Divider,
        showsVerticalScrollIndicator: false,
      }}
    />
  );
}
