import { useCallback, useEffect, useMemo } from 'react';
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
} from '@onekeyhq/components';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatCurrency } from '../../../components/Format';
import { useActiveWalletAccount, useAppSelector } from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import { useNativeToken, useTokenBalance } from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { formatAmount } from '../../../utils/priceUtils';
import { PendingKeleTransaction } from '../components/PendingTransaction';
import {
  useIntlMinutes,
  useKeleDashboardInfo,
  useKeleHistory,
  useKeleMinerOverview,
  useKeleUnstakeOverview,
  usePendingWithdraw,
} from '../hooks';
import { EthStakingSource, StakingRoutes } from '../typing';

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
  const minerOverview = useKeleMinerOverview(networkId, accountId);
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
            {formatAmount(minerOverview?.amount.retail_staked ?? '0', 8)}
          </Typography.Body1>
          <Typography.Body1> ETH</Typography.Body1>
        </Box>
        <Box flexDirection="row">
          <Button size="xs" onPress={onUnstake}>
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
            {formatAmount(minerOverview?.amount.withdrawable ?? '0', 8)}
          </Typography.Body1>
          <Typography.Body1> ETH</Typography.Body1>
        </Box>
        <Box flexDirection="row">
          <Button size="xs" onPress={onWithdraw}>
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
    <Box mb="2">
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
    </Box>
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
    <Box mb="2">
      <Alert
        dismiss={false}
        alertType="info"
        title={intl.formatMessage(
          { id: 'msg__withdraw_in_progress_str' },
          { '0': `${formatAmount(accountPendingWithdraw, 8)} ETH` },
        )}
      />
    </Box>
  ) : null;
};

const PendingStakeContent = () => {
  const intl = useIntl();
  const { networkId, accountId } = useActiveWalletAccount();
  const transactions = useAppSelector((s) => s.staking.keleTransactions);
  const txs = useMemo(() => {
    if (!transactions) {
      return [];
    }
    const items = transactions[accountId]?.[networkId] ?? [];
    return items.filter((item) => !item.archive && item.type === 'KeleStake');
  }, [transactions, networkId, accountId]);

  const total = txs.reduce(
    (result, item) => result + Number(item.amount ?? 0),
    0,
  );

  return total > 0 ? (
    <Box mb="2">
      <Alert
        alertType="info"
        title={intl.formatMessage(
          {
            id: 'msg__str_is_staking_in_progress',
          },
          { '0': `${total} ETH` },
        )}
        dismiss={false}
      />
      {txs.map((tx) => (
        <PendingKeleTransaction tx={tx} key={tx.hash} />
      ))}
    </Box>
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
  const keleDashboardInfo = useKeleDashboardInfo(networkId);
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
        screen: StakingRoutes.ETHStake,
        params: {
          source: EthStakingSource.Kele,
        },
      },
    });
  }, [navigation]);

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
      <Box mt="2">
        {stakingAmount ? (
          <Box
            p="4"
            borderRadius={12}
            bg="surface-default"
            flexDirection="row"
            alignItems="center"
            mb="2"
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
                      keleDashboardInfo?.validator_alive_predicted_hour ?? '24',
                    '3': `${(
                      keleDashboardInfo?.retail_deposit_far ?? 32
                    ).toFixed(2)} ETH`,
                  },
                )}
              </Typography.Body2>
            </Box>
          </Box>
        ) : null}
        <UnstakePendingAlert />
        <WithdrawPendingAlert />
        <PendingStakeContent />
      </Box>
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
  const opType = Number(item.op_type);
  let title = intl.formatMessage({ id: 'action__stake' });
  let status = '';
  if (opType === 1) {
    title = intl.formatMessage({ id: 'form__staking' });
    if (item.remain_time) {
      status = intl.formatMessage({ id: 'transaction__pending' });
    }
  } else if (opType === 2) {
    title = intl.formatMessage({ id: 'form__unstaking' });
    if (item.remain_time) {
      status = intl.formatMessage({ id: 'transaction__pending' });
    }
  } else if (opType === 3 || opType === 4) {
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
