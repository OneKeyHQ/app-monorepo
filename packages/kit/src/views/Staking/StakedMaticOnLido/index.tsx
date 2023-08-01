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
  useSimpleTokenPriceValue,
  useSingleToken,
} from '../../../hooks/useTokens';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../routes/routesEnum';
import { addTransaction } from '../../../store/reducers/staking';
import { formatAmount } from '../../../utils/priceUtils';
import { formatDecimalZero } from '../../Market/utils';
import { formatAmountExact, gt, plus } from '../../Swap/utils';
import { getMaticContractAdderess } from '../address';
import { PendingLidoTransaction } from '../components/PendingTransaction';
import { useLidoMaticOverview } from '../hooks';
import { StakingRoutes } from '../typing';
import { StakingTypes, getTransactionStakingType } from '../utils';

import type {
  LidoMaticNFTStatus,
  LidoMaticOverview,
  StakingRoutesParams,
} from '../typing';
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
  return formatAmount(value, 6);
};

const ClaimAlert = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { networkId, accountId } = route.params;
  const lidoMaticOverview = useLidoMaticOverview(networkId, accountId);
  const onPress = useCallback(async () => {
    if (!lidoMaticOverview || !accountId) {
      return;
    }
    const account = await backgroundApiProxy.engine.getAccount(
      accountId,
      networkId,
    );
    const items = lidoMaticOverview.nfts ?? [];
    const nfts = items.filter((item) => item.claimable);
    const requests = nfts.map((nft) => nft.nftId);
    if (requests.length > 1) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Staking,
        params: {
          screen: StakingRoutes.LidoMaticClaim,
          params: {
            accountId: account.id,
            networkId,
          },
        },
      });
      return;
    }
    const claimTx =
      await backgroundApiProxy.serviceStaking.buildLidoMaticClaimWithdrawals({
        nftId: requests[0],
        networkId,
      });

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
                  type: 'lidoClaimMatic',
                  nonce: data?.decodedTx?.nonce,
                  addedTime: Date.now(),
                },
              }),
            );
          },
        },
      },
    });
  }, [navigation, lidoMaticOverview, networkId, accountId]);

  const claimable = useMemo(() => {
    let withdrawal = '0';
    const items = lidoMaticOverview?.nfts;
    if (!items) {
      return { withdrawal };
    }
    const claimableItems = items.filter((item) => item.claimable);
    if (claimableItems.length > 0) {
      withdrawal = claimableItems.reduce(
        (result, item) => plus(result, item.maticAmount),
        '0',
      );
    }
    return { withdrawal, items: claimableItems };
  }, [lidoMaticOverview]);

  if (gt(claimable.withdrawal, '0')) {
    return (
      <Alert
        alertType="info"
        title={`${formatAmountExact(
          claimable.withdrawal,
          4,
        )} MATIC ${intl.formatMessage({
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
        getTransactionStakingType(item.type) === StakingTypes.matic,
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
  const symbol = 'stMATIC';
  const lidoMaticOverview = useLidoMaticOverview(networkId, accountId);
  const { token: maticToken } = useSingleToken(
    networkId,
    getMaticContractAdderess(networkId),
  );
  const balance = useTokenBalance({ networkId, accountId, token: maticToken });
  const navigation = useNavigation<NavigationProps['navigation']>();
  const mainPrice = useSimpleTokenPriceValue({
    networkId,
    contractAdress: getMaticContractAdderess(networkId),
  });

  const onUnstake = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.LidoMaticUnstake,
        params: {
          networkId,
          accountId,
        },
      },
    });
  }, [navigation, networkId, accountId]);

  const onLidoMaticStakeShouldUnderstand = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.LidoMaticStakeShouldUnderstand,
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
        screen: StakingRoutes.MaticStake,
        params: {
          networkId,
          accountId,
        },
      },
    });
  }, [navigation, networkId, accountId]);

  const totalAmount = lidoMaticOverview?.balance ?? '0.00';
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
          onPress={onLidoMaticStakeShouldUnderstand}
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
          {formatAmount(balance, 6)} MATIC
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
    backgroundApiProxy.serviceStaking.fetchLidoMaticOverview({
      networkId,
      accountId,
    });
    // eslint-disable-next-line
  }, []);
  const lidoOverview = useLidoMaticOverview(networkId, accountId);

  const nfts = useMemo(() => {
    if (!lidoOverview) {
      return [];
    }
    const items = lidoOverview.nfts ? [...lidoOverview.nfts] : [];
    return items.sort((a, b) => b.nftId - a.nftId);
  }, [lidoOverview]);

  const renderItem: ListRenderItem<LidoMaticNFTStatus> = useCallback(
    ({ item, index }) => (
      <Box
        py="4"
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
                +{formatstETHNum(item.maticAmount)}MATIC
              </Typography.Body1Strong>
            </Box>
            <Box w="full" flexDirection="row" justifyContent="space-between">
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage(
                  { id: 'form__est_str' },
                  {
                    '0': intl.formatMessage(
                      { id: 'form__str_day' },
                      { 0: ' 3 - 4' },
                    ),
                  },
                )}
              </Typography.Body2>
              <Typography.Body2 color="text-highlight">
                {item.claimable
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
        keyExtractor: (item: LidoMaticOverview) => String(item.nftId),
        ItemSeparatorComponent: Divider,
        showsVerticalScrollIndicator: false,
      }}
    >
      <ListHeaderComponent />
    </Modal>
  );
}
