import { useCallback, useEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
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
import { useActiveWalletAccount, useAppSelector } from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import { useNativeToken, useTokenBalance } from '../../../hooks/useTokens';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../routes/routesEnum';
import { addTransaction } from '../../../store/reducers/staking';
import { formatAmount } from '../../../utils/priceUtils';
import PendingTransaction from '../components/PendingTransaction';
import { useLidoOverview } from '../hooks';
import { EthStakingSource, StakingRoutes } from '../typing';

import type { LidoNFTStatus, StakingRoutesParams } from '../typing';
import type { ListRenderItem } from 'react-native';

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

const ClaimAlert = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { networkId, account } = useActiveWalletAccount();
  const lidoOverview = useLidoOverview(networkId, account?.id);
  const onPress = useCallback(async () => {
    if (!lidoOverview || !account) {
      return;
    }
    const nfts = lidoOverview.nfts.filter(
      (item) => !item.isClaimed && item.isFinalized,
    );
    const requests = nfts.map((nft) => nft.requestId);
    const claimTx =
      await backgroundApiProxy.serviceStaking.buildLidoClaimWithdrawals({
        requestIds: requests,
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
  }, [navigation, lidoOverview, account, networkId]);

  if (!lidoOverview || Number(lidoOverview.withdrawal) <= 0) {
    return null;
  }

  return (
    <Alert
      alertType="info"
      title={`${lidoOverview.withdrawal} ETH ${intl.formatMessage({
        id: 'form__available_for_claim',
      })}`}
      dismiss={false}
      onAction={onPress}
      action={intl.formatMessage({ id: 'form__claim' })}
    />
  );
};

const PendingTransactionAlert = () => {
  const intl = useIntl();
  const { networkId, accountId } = useActiveWalletAccount();
  const transactions = useAppSelector((s) => s.staking.transactions);
  const txs = useMemo(() => {
    if (!transactions) {
      return [];
    }
    const items = transactions[accountId]?.[networkId] ?? [];
    return items.filter((item) => !item.archive);
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
        <PendingTransaction tx={tx} key={tx.hash} />
      ))}
    </Box>
  ) : null;
};

const ListHeaderComponent = () => {
  const intl = useIntl();
  const { networkId, accountId } = useActiveWalletAccount();
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
        params: {},
      },
    });
  }, [navigation]);

  const onStake = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.ETHStake,
        params: {
          source: EthStakingSource.Lido,
        },
      },
    });
  }, [navigation]);

  const totalAmount = lidoOverview?.balance ?? '0';
  const totalAmountText = formatAmount(totalAmount, 8);
  const isApproximate = Number(totalAmountText) !== Number(totalAmount);

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
        <Typography.Body2 color="text-subdued">
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
  const { networkId, accountId } = useActiveWalletAccount();
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
    const items = [...lidoOverview.nfts];
    return items.sort((a, b) => b.requestId - a.requestId);
  }, [lidoOverview]);

  const renderItem: ListRenderItem<LidoNFTStatus> = useCallback(
    ({ item, index }) => (
      <Box
        py="4"
        px="6"
        bg="surface-default"
        overflow="hidden"
        borderTopRadius={index === 0 ? 12 : undefined}
        borderBottomRadius={nfts && index === nfts.length - 1 ? 12 : undefined}
        flexDirection="row"
        justifyContent="space-between"
      >
        <Box flexDirection="row" alignItems="center">
          <Image
            w="8"
            h="8"
            borderRadius="full"
            source={require('@onekeyhq/kit/assets/staking/eth_logo.png')}
          />
          <Box ml="2">
            <Typography.Body1Strong>
              {intl.formatMessage({ id: 'action_unstake' })} #{item.requestId}
            </Typography.Body1Strong>
            <Typography.Body2>est. 1 - 5 days</Typography.Body2>
          </Box>
        </Box>
        <Box alignItems="flex-end">
          <Typography.Body1Strong>
            +{Number(item.stETH)}ETH
          </Typography.Body1Strong>
          <Typography.Body2 color="text-highlight">
            {item.isFinalized
              ? intl.formatMessage({ id: 'form__available_for_claim' })
              : intl.formatMessage({ id: 'transaction__pending' })}
          </Typography.Body2>
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
