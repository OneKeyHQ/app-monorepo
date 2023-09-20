import { useCallback, useEffect, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Button,
  Divider,
  Empty,
  IconButton,
  Image,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatCurrency } from '../../../components/Format';
import { useAppSelector, useTokenBalance } from '../../../hooks';
import {
  useNativeToken,
  useSimpleTokenPriceValue,
} from '../../../hooks/useTokens';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../routes/routesEnum';
import { addTransaction } from '../../../store/reducers/staking';
import { formatAmount } from '../../../utils/priceUtils';
import { formatDecimalZero } from '../../Market/utils';
import { formatAmountExact, gt } from '../../Swap/utils';
import { PendingLidoTransaction } from '../components/PendingTransaction';
import { useLidoOverview } from '../hooks';
import { EthStakingSource, StakingRoutes } from '../typing';
import { StakingTypes, getTransactionStakingType } from '../utils';

import type { LidoNFTStatus, StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';
import type { ListRenderItem } from 'react-native';

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

type RouteProps = RouteProp<
  StakingRoutesParams,
  StakingRoutes.LidoEthUnstakeShouldUnderstand
>;

const formatstETHNum = (value: string) => {
  const bn = new BigNumber(value);
  if (bn.lt('0.00000001')) {
    return formatDecimalZero(bn.toNumber());
  }
  return formatAmount(value, 18);
};

const ClaimAlert = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { networkId, accountId } = route.params;
  const lidoOverview = useLidoOverview(networkId, accountId);
  const onPress = useCallback(async () => {
    if (!lidoOverview || !accountId) {
      return;
    }
    const items = lidoOverview.nfts ?? [];
    const nfts = items.filter((item) => !item.isClaimed && item.isFinalized);
    const requests = nfts.map((nft) => nft.requestId);
    const claimTx =
      await backgroundApiProxy.serviceStaking.buildLidoClaimWithdrawals({
        requestIds: requests,
        networkId,
      });
    const account = await backgroundApiProxy.engine.getAccount(
      accountId,
      networkId,
    );
    const encodedTx: IEncodedTxEvm = {
      ...claimTx,
      from: account.address,
    };
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendModalRoutes.SendConfirm,
        params: {
          accountId: account.id,
          networkId,
          feeInfoEditable: true,
          feeInfoUseFeeInTx: false,
          encodedTx,
          onSuccess(tx, data) {
            backgroundApiProxy.dispatch(
              addTransaction({
                accountId: account.id,
                networkId,
                transaction: {
                  hash: tx.txid,
                  accountId: account.id,
                  networkId,
                  type: 'lidoClaim',
                  nonce: data?.decodedTx?.nonce,
                  addedTime: Date.now(),
                },
              }),
            );
          },
        },
      },
    });
  }, [navigation, lidoOverview, networkId, accountId]);

  if (
    lidoOverview &&
    lidoOverview.nfts &&
    lidoOverview.nfts.length &&
    lidoOverview.withdrawal &&
    Number(lidoOverview.withdrawal) > 0
  ) {
    return (
      <Alert
        alertType="info"
        title={`${formatAmountExact(
          lidoOverview.withdrawal,
          4,
        )} ETH ${intl.formatMessage({
          id: 'form__available_for_claim',
        })}`}
        dismiss={false}
        onAction={onPress}
        action={intl.formatMessage({ id: 'form__claim' })}
      />
    );
  }
  return null;
};

const PendingTransactionAlert = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId, accountId } = route.params;
  const transactions = useAppSelector((s) => s.staking.transactions);
  const txs = useMemo(() => {
    if (!transactions) {
      return [];
    }
    const items = transactions[accountId]?.[networkId] ?? [];
    return items.filter(
      (item) =>
        !item.archive &&
        getTransactionStakingType(item.type) === StakingTypes.eth,
    );
  }, [transactions, networkId, accountId]);

  return txs.length > 0 ? (
    <Box>
      <Alert
        alertType="info"
        title={intl.formatMessage(
          {
            id: 'msg__there_are_str_requests_waiting_for_confirmation_currently',
          },
          { '0': txs.length },
        )}
        dismiss={false}
      />
      {txs.map((tx) => (
        <PendingLidoTransaction tx={tx} key={tx.hash} />
      ))}
    </Box>
  ) : null;
};

const ListHeaderComponent = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId, accountId } = route.params;
  const symbol = 'stETH';
  const lidoOverview = useLidoOverview(networkId, accountId);
  const nativeToken = useNativeToken(networkId);
  const balance = useTokenBalance({ networkId, accountId, token: nativeToken });
  const navigation = useNavigation<NavigationProps['navigation']>();
  const mainPrice = useSimpleTokenPriceValue({ networkId });

  const onUnstake = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.LidoEthUnstakeShouldUnderstand,
        params: {
          networkId,
          accountId,
        },
      },
    });
  }, [navigation, networkId, accountId]);

  const onLidoEthStakeShouldUnderstand = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.LidoEthStakeShouldUnderstand,
        params: {
          readonly: true,
          networkId,
          accountId,
        },
      },
    });
  }, [navigation, networkId, accountId]);

  const onStake = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.ETHStake,
        params: {
          networkId,
          accountId,
          source: EthStakingSource.Lido,
        },
      },
    });
  }, [navigation, networkId, accountId]);

  const totalAmount = lidoOverview?.balance ?? '0.00';
  const totalAmountText = gt(totalAmount, '0')
    ? formatAmount(totalAmount, 8)
    : '0.00';

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
          onPress={onLidoEthStakeShouldUnderstand}
        />
      </Box>
      <Box mt="2">
        <Box flexDirection="row" alignItems="center">
          <Typography.DisplayXLarge>{`${totalAmountText} ${symbol}`}</Typography.DisplayXLarge>
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
      <Box my="4" flexDirection="row">
        <Box flex="1">
          <Button size="xl" w="full" type="primary" onPress={onStake}>
            {intl.formatMessage({ id: 'action__stake' })}
          </Button>
        </Box>
        <Box w="4" />
        <Box flex="1">
          <Button size="xl" w="full" onPress={onUnstake}>
            {intl.formatMessage({ id: 'action__unstake' })}
          </Button>
        </Box>
      </Box>
      <Box flexDirection="row" justifyContent="space-between">
        <Typography.Body2 color="text-subdued">
          {intl.formatMessage({ id: 'form__available_to_stake' })}
        </Typography.Body2>
        <Typography.Body2 color="text-default">
          {formatAmount(balance, 6)} ETH
        </Typography.Body2>
      </Box>
      <VStack space="4" mt="4">
        <ClaimAlert />
        <PendingTransactionAlert />
      </VStack>
      <Box my="2">
        <Typography.Heading>
          {intl.formatMessage({ id: 'form__active_request' })}
        </Typography.Heading>
      </Box>
    </Box>
  );
};

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Box py="10">
      <Empty emoji="🕐" title={intl.formatMessage({ id: 'empty__no_data' })} />
    </Box>
  );
};

export default function StakedETHOnLido() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId, accountId } = route.params;
  useEffect(() => {
    backgroundApiProxy.serviceStaking.fetchLidoOverview({
      networkId,
      accountId,
    });
    backgroundApiProxy.serviceStaking.fetchEthAprSma();
    // eslint-disable-next-line
  }, []);
  const lidoOverview = useLidoOverview(networkId, accountId);

  const nfts = useMemo(() => {
    if (!lidoOverview) {
      return [];
    }
    const items = lidoOverview.nfts ? [...lidoOverview.nfts] : [];
    return items.sort((a, b) => b.requestId - a.requestId);
  }, [lidoOverview]);

  const renderItem: ListRenderItem<LidoNFTStatus> = useCallback(
    ({ item, index }) => (
      <Box
        py="4"
        // px="6"
        // bg="surface-default"
        overflow="hidden"
        borderTopRadius={index === 0 ? 12 : undefined}
        borderBottomRadius={nfts && index === nfts.length - 1 ? 12 : undefined}
        flexDirection="row"
        justifyContent="space-between"
      >
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          w="full"
        >
          <Image
            w="8"
            h="8"
            borderRadius="full"
            source={require('@onekeyhq/kit/assets/staking/eth_logo.png')}
            mr="2"
          />
          <Box flex="1">
            <Box w="full" flexDirection="row" justifyContent="space-between">
              <Typography.Body1Strong mr="2">
                {intl.formatMessage({ id: 'action_unstake' })}
              </Typography.Body1Strong>
              <Typography.Body1Strong isTruncated>
                +{formatstETHNum(item.stETH)}ETH
              </Typography.Body1Strong>
            </Box>
            <Box w="full" flexDirection="row" justifyContent="space-between">
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage(
                  { id: 'form__est_str' },
                  {
                    '0': intl.formatMessage(
                      { id: 'form__str_day' },
                      { 0: ' 1 - 5' },
                    ),
                  },
                )}
              </Typography.Body2>
              <Typography.Body2 color="text-highlight">
                {item.isFinalized
                  ? intl.formatMessage({ id: 'form__available_for_claim' })
                  : intl.formatMessage({ id: 'transaction__pending' })}
              </Typography.Body2>
            </Box>
          </Box>
        </Box>
      </Box>
    ),
    [nfts, intl],
  );

  return (
    <Modal
      height="560px"
      footer={null}
      flatListProps={{
        data: nfts,
        // @ts-ignore
        renderItem,
        ListHeaderComponent,
        ListEmptyComponent,
        // @ts-ignore
        keyExtractor: (item: LidoNFTStatus) => String(item.requestId),
        ItemSeparatorComponent: Divider,
        showsVerticalScrollIndicator: false,
      }}
    >
      <ListHeaderComponent />
    </Modal>
  );
}
