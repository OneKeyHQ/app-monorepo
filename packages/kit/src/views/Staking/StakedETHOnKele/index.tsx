import { useCallback, useEffect } from 'react';
import type { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { format as dateFormat, parse } from 'date-fns';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Alert,
  Box,
  Button,
  Center,
  Divider,
  Empty,
  Icon,
  IconButton,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatCurrency } from '../../../components/Format';
import { useActiveWalletAccount, useAppSelector } from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import { useNativeToken, useTokenBalance } from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { formatAmount } from '../../../utils/priceUtils';
import {
  useIntlMinutes,
  useKeleHistory,
  useKeleMinerOverview,
  useKeleUnstakeOverview,
  useKeleWithdrawOverview,
  usePendingWithdraw,
} from '../hooks';
import { StakingRoutes } from '../typing';

import type {
  KeleGenericHistory,
  KeleIncomeDTO,
  KeleOpHistoryDTO,
  StakingRoutesParams,
} from '../typing';
import type { ListRenderItem } from 'react-native';

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

function prefixAmount(amount: number) {
  return Number(amount) > 0
    ? `+${formatAmount(amount, 18)}`
    : formatAmount(amount, 18);
}

const KeleOverview = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { networkId, accountId } = useActiveWalletAccount();
  const unstakeOverview = useKeleUnstakeOverview(networkId, accountId);
  const withdrawOverview = useKeleWithdrawOverview(networkId, accountId);
  const enableETH2Unstake = useAppSelector((s) => s.settings.enableETH2Unstake);
  const onUnstake = useCallback(() => {
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
  const onWithdraw = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.WithdrawAmount,
        params: {
          networkId,
        },
      },
    });
  }, [navigation, networkId]);
  return (
    <Box
      borderRadius={12}
      flexDirection="row"
      px="3"
      py="3"
      mt="3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="border-subdued"
      justifyContent="space-between"
    >
      <Box flex="1">
        <Typography.Caption color="text-subdued" fontSize="14px">
          {intl.formatMessage({ id: 'form__staking_uppercase' })}
        </Typography.Caption>
        <Box mb="2" mt="1" flexDirection="row" alignItems="center">
          <Typography.Body1>
            {formatAmount(unstakeOverview?.retail_staked ?? '0', 8)}
          </Typography.Body1>
          <Typography.Body1> ETH</Typography.Body1>
        </Box>
        <Box flexDirection="row">
          <Button size="xs" onPress={onUnstake} isDisabled={!enableETH2Unstake}>
            {intl.formatMessage({ id: 'action_unstake' })}
          </Button>
        </Box>
      </Box>
      <Box
        w="6"
        flexDirection="row"
        justifyContent="center"
        alignItems="center"
      >
        <Divider orientation="vertical" color="divider" />
      </Box>
      <Box flex="1">
        <Typography.Caption color="text-subdued" fontSize="14px">
          {intl.formatMessage({ id: 'form__unstaked_uppercase' })}
        </Typography.Caption>
        <Box mb="2" mt="1" flexDirection="row" alignItems="center">
          <Typography.Body1>
            {formatAmount(withdrawOverview?.balance ?? '0', 8)}
          </Typography.Body1>
          <Typography.Body1> ETH</Typography.Body1>
        </Box>
        <Box flexDirection="row">
          <Button
            size="xs"
            onPress={onWithdraw}
            isDisabled={!enableETH2Unstake}
          >
            {intl.formatMessage({ id: 'action__withdraw' })}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

const UnstakePendingAlert = () => {
  const intl = useIntl();
  const { networkId, accountId } = useActiveWalletAccount();
  const minerOverview = useKeleMinerOverview(networkId, accountId);
  const retailUnstaking = Number(minerOverview?.amount.retail_unstaking ?? 0);
  const unstakeOverview = useKeleUnstakeOverview(networkId, accountId);

  const sec = unstakeOverview?.estimate_use_sec ?? 60;
  const minutes = useIntlMinutes(Math.floor(sec / 60));

  useEffect(() => {
    if (retailUnstaking) {
      const timer = setInterval(() => {
        backgroundApiProxy.serviceStaking.fetchMinerOverview({
          networkId,
          accountId,
        });
      }, 30 * 1000);
      return () => clearInterval(timer);
    }
  }, [networkId, accountId, retailUnstaking]);

  return retailUnstaking ? (
    <Alert
      dismiss={false}
      alertType="info"
      title={intl.formatMessage(
        { id: 'msg__unstaking_in_progress_str' },
        { '0': `${formatAmount(retailUnstaking, 8)} ETH ` },
      )}
      description={intl.formatMessage(
        { id: 'msg__unstaking_in_progress_str_desc' },
        { '0': ` ${minutes}` },
      )}
    />
  ) : null;
};

const WithdrawPendingAlert = () => {
  const intl = useIntl();
  const { networkId, accountId } = useActiveWalletAccount();
  const accountPendingWithdraw = usePendingWithdraw(networkId, accountId);
  useEffect(() => {
    if (accountPendingWithdraw) {
      const timer = setInterval(() => {
        backgroundApiProxy.serviceStaking.fetchPendingWithdrawAmount({
          networkId,
          accountId,
        });
      }, 120 * 1000);
      return () => clearInterval(timer);
    }
  }, [networkId, accountId, accountPendingWithdraw]);
  return accountPendingWithdraw ? (
    <Alert
      dismiss={false}
      alertType="info"
      title={intl.formatMessage(
        { id: 'msg__withdraw_in_progress_str' },
        { '0': `${formatAmount(accountPendingWithdraw, 8)} ETH` },
      )}
    />
  ) : null;
};

const ListHeaderComponent = () => {
  const intl = useIntl();
  const { networkId, accountId } = useActiveWalletAccount();
  const minerOverview = useKeleMinerOverview(networkId, accountId);
  const nativeToken = useNativeToken(networkId);
  const balance = useTokenBalance({ networkId, accountId, token: nativeToken });
  const navigation = useNavigation<NavigationProps['navigation']>();
  const mainPrice = useSimpleTokenPriceValue({ networkId });
  const keleDashboardGlobal = useAppSelector(
    (s) => s.staking.keleDashboardGlobal,
  );

  const onUnstake = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.KeleEthUnstakeShouldUnderstand,
        params: {
          networkId,
          readonly: true,
        },
      },
    });
  }, [navigation, networkId]);

  const onStake = useCallback(() => {
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

  const totalAmount =
    Number(minerOverview?.amount?.total_amount ?? 0) +
    Number(minerOverview?.amount.withdrawable ?? 0);
  const totalAmountText = formatAmount(totalAmount, 8);
  const isApproximate = Number(totalAmountText) !== totalAmount;
  const stakingAmount = Number(minerOverview?.amount?.staking_amount ?? 0);

  return (
    <Box>
      <Box
        flexDirection="row"
        justifyContent="space-between"
        w="full"
        alignItems="center"
      >
        <Typography.Heading>
          {intl.formatMessage({ id: 'content__total' })}
        </Typography.Heading>
        <IconButton
          type="plain"
          name="QuestionMarkCircleOutline"
          size="sm"
          onPress={onUnstake}
        />
      </Box>
      <Box mt="2">
        <Box flexDirection="row" alignItems="center">
          {isApproximate ? (
            <Typography.Caption mr="1">~</Typography.Caption>
          ) : null}
          <Typography.DisplayXLarge>{`${totalAmountText} ETH`}</Typography.DisplayXLarge>
        </Box>
        <FormatCurrency
          numbers={[mainPrice ?? 0, totalAmount]}
          render={(ele) => (
            <Typography.Body2 color="text-subdued">
              {mainPrice ? ele : '-'}
            </Typography.Body2>
          )}
        />
      </Box>
      <Box my="4">
        <Button size="xl" w="full" type="primary" onPress={onStake}>
          {intl.formatMessage({ id: 'title__stake_str' }, { '0': 'ETH' })}
        </Button>
      </Box>
      <Box flexDirection="row" justifyContent="space-between">
        <Typography.Body2 color="text-subdued">
          {intl.formatMessage({ id: 'form__available_to_stake' })}
        </Typography.Body2>
        <Typography.Body2 color="text-subdued">
          {formatAmount(balance, 6)} ETH
        </Typography.Body2>
      </Box>
      <KeleOverview />
      <VStack space="2" mt="2">
        {stakingAmount ? (
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
                  { '0': `${stakingAmount} ETH` },
                )}
              </Typography.Body1>
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage(
                  { id: 'form__str_is_activating_eth_desc' },
                  {
                    '0': 'ETH',
                    '1':
                      keleDashboardGlobal?.validator_alive_predicted_hour ??
                      '24',
                    '3': `${(
                      keleDashboardGlobal?.retail_deposit_far ?? 32
                    ).toFixed(2)} ETH`,
                  },
                )}
              </Typography.Body2>
            </Box>
          </Box>
        ) : null}
        <UnstakePendingAlert />
        <WithdrawPendingAlert />
      </VStack>
      <Box my="2">
        <Typography.Heading>
          {intl.formatMessage({ id: 'form__reward_history' })}
        </Typography.Heading>
      </Box>
    </Box>
  );
};

const RewardHistory: FC<{ item: KeleIncomeDTO }> = ({ item }) => {
  const intl = useIntl();
  const { networkId } = useActiveWalletAccount();
  const mainPrice = useSimpleTokenPriceValue({ networkId });
  return (
    <Box w="full">
      <Box justifyContent="space-between" flexDirection="row" mb="1">
        <Typography.Body1Strong>
          {intl.formatMessage({ id: 'title__reward' })}
        </Typography.Body1Strong>
        <Typography.Body1Strong>
          {prefixAmount(item.reward)} ETH
        </Typography.Body1Strong>
      </Box>
      <Box justifyContent="space-between" flexDirection="row">
        <Typography.Body2 color="text-subdued">
          {dateFormat(new Date(item.date), 'LLL dd yyyy')}
        </Typography.Body2>
        <FormatCurrency
          numbers={[mainPrice ?? 0, item.reward ?? 0]}
          render={(ele) => (
            <Typography.Body2 ml={3} color="text-subdued">
              {mainPrice ? ele : '-'}
            </Typography.Body2>
          )}
        />
      </Box>
    </Box>
  );
};

const OpHistory: FC<{ item: KeleOpHistoryDTO }> = ({ item }) => {
  const intl = useIntl();
  const { networkId } = useActiveWalletAccount();
  const mainPrice = useSimpleTokenPriceValue({ networkId });
  const opType = item.op_type;
  let title = intl.formatMessage({ id: 'action__stake' });
  let status = '';
  if ([0, 1].includes(opType)) {
    title = intl.formatMessage({ id: 'form__staking' });
    status = intl.formatMessage({ id: 'transaction__pending' });
  } else if ([2].includes(opType)) {
    title = intl.formatMessage({ id: 'form__staking' });
  } else if ([3, 4].includes(opType)) {
    title = intl.formatMessage({ id: 'form__unstaking' });
    status = intl.formatMessage({ id: 'transaction__pending' });
  } else if ([5].includes(opType)) {
    title = intl.formatMessage({ id: 'form__unstaking' });
  } else if ([6].includes(opType)) {
    title = intl.formatMessage({ id: 'action__withdraw' });
    status = intl.formatMessage({ id: 'transaction__pending' });
  } else if ([7, 8].includes(opType)) {
    title = intl.formatMessage({ id: 'action__withdraw' });
  }

  return (
    <Box w="full">
      <Box justifyContent="space-between" flexDirection="row" mb="1">
        <Typography.Body1Strong>{title}</Typography.Body1Strong>
        <Typography.Body1Strong>
          {prefixAmount(item.amount)} ETH
        </Typography.Body1Strong>
      </Box>
      <Box justifyContent="space-between" flexDirection="row">
        <Typography.Body2 color="text-subdued">
          {dateFormat(
            parse(item.history_time, 'yyyy-MM-dd HH:mm:ss', new Date()),
            'LLL dd yyyy',
          )}
        </Typography.Body2>
        {status ? (
          <Box>
            <Typography.Body2 color="text-highlight">{status}</Typography.Body2>
          </Box>
        ) : (
          <FormatCurrency
            numbers={[mainPrice ?? 0, item.amount ?? 0]}
            render={(ele) => (
              <Typography.Body2 ml={3} color="text-subdued">
                {mainPrice ? ele : '-'}
              </Typography.Body2>
            )}
          />
        )}
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
  const { networkId, accountId } = useActiveWalletAccount();
  const history = useKeleHistory(networkId, accountId);

  useEffect(() => {
    backgroundApiProxy.serviceStaking.fetchPendingWithdrawAmount({
      networkId,
      accountId,
    });
    backgroundApiProxy.serviceStaking.fetchMinerOverview({
      accountId,
      networkId,
    });
    backgroundApiProxy.serviceStaking.fetchKeleIncomeHistory({
      accountId,
      networkId,
    });
    backgroundApiProxy.serviceStaking.fetchKeleOpHistory({
      accountId,
      networkId,
    });
    backgroundApiProxy.serviceStaking.getDashboardGlobal({ networkId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const renderItem: ListRenderItem<KeleGenericHistory> = useCallback(
    ({ item, index }) => (
      <Box
        py="4"
        px="6"
        bg="surface-default"
        overflow="hidden"
        borderTopRadius={index === 0 ? 12 : undefined}
        borderBottomRadius={
          history && index === history.length - 1 ? 12 : undefined
        }
      >
        {item.op ? <OpHistory item={item.op} /> : null}
        {item.income ? <RewardHistory item={item.income} /> : null}
      </Box>
    ),
    [history],
  );
  return (
    <Modal
      height="560px"
      footer={null}
      flatListProps={{
        data: history ?? [],
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
