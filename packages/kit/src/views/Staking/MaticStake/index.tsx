import { useCallback, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  Modal,
  Text,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import { ToastManagerType } from '@onekeyhq/components/src/ToastManager';
import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AutoSizeText } from '../../../components/AutoSizeText';
import { FormatCurrency } from '../../../components/Format';
import { useTokenBalanceWithoutFrozen } from '../../../hooks';
import {
  useSimpleTokenPriceValue,
  useSingleToken,
} from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { addTransaction } from '../../../store/reducers/staking';
import { formatAmount } from '../../../utils/priceUtils';
import { SendModalRoutes } from '../../Send/types';
import { useSwapSend } from '../../Swap/hooks/useSwapSend';
import {
  combinedTasks,
  getTokenAmountString,
  multiply,
} from '../../Swap/utils';
import { getMaticContractAdderess } from '../address';
import { StakingKeyboard } from '../components/StakingKeyboard';
import { useLidoMaticOverview } from '../hooks';

import type { Task } from '../../Swap/utils';
import type { StakingRoutes, StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<StakingRoutesParams, StakingRoutes.ETHStake>;

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

type StakingTransactionData = {
  data: string;
  to: string;
  value: string;
};

export default function MaticStaking() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { accountId, networkId } = route.params;
  const sendTx = useSwapSend();
  const overview = useLidoMaticOverview(networkId, accountId);
  const maticTokenAddress = getMaticContractAdderess(networkId);
  const navigation = useNavigation<NavigationProps['navigation']>();
  const mainPrice = useSimpleTokenPriceValue({
    networkId,
    contractAdress: maticTokenAddress,
  });

  const [loading, setLoading] = useState(false);

  const [amount, setAmount] = useState('');
  const { token: tokenInfo } = useSingleToken(networkId, maticTokenAddress);

  const tokenBalance = useTokenBalanceWithoutFrozen({
    networkId,
    accountId,
    token: tokenInfo,
    fallback: '0',
  });

  const errorMsg = useMemo(() => {
    if (!tokenInfo || !amount) {
      return 'error';
    }
    const amountBN = new BigNumber(amount);
    const balanceBN = new BigNumber(tokenBalance);
    const { symbol } = tokenInfo;
    if (
      amountBN.isNaN() ||
      balanceBN.isNaN() ||
      balanceBN.isLessThan(amountBN)
    ) {
      return intl.formatMessage({ id: 'form__amount_invalid' }, { 0: symbol });
    }
    return undefined;
  }, [amount, intl, tokenBalance, tokenInfo]);

  const minAmountErrMsg = useMemo(() => {
    const minAmountBN = new BigNumber('0.0000001');
    const minAmountRequired = !minAmountBN.isNaN() && minAmountBN.gt('0');
    const symbol = tokenInfo?.symbol ?? '';
    if (minAmountRequired) {
      const input = amount.trim();
      const amountBN = new BigNumber(input);
      if (
        input &&
        (amountBN.isNaN() || (amountBN.gt(0) && amountBN.lt(minAmountBN)))
      ) {
        return `${intl.formatMessage({
          id: 'form__min_amount',
        })} ${minAmountBN.toFixed()} ${symbol}`;
      }
    }
  }, [amount, intl, tokenInfo]);

  const userInput = useCallback(
    (percent: number) => {
      const bn = new BigNumber(tokenBalance);
      if (bn.lte(0)) {
        return;
      }
      const text =
        percent >= 100
          ? tokenBalance
          : formatAmount(bn.multipliedBy(percent).dividedBy(100), 8);
      setAmount(text);
    },
    [tokenBalance],
  );

  const onPrimaryActionPress = useCallback(
    async ({ onClose }: { onClose?: () => void }) => {
      if (!accountId || !tokenInfo) {
        return;
      }
      try {
        setLoading(true);
        const walletId = getWalletIdFromAccountId(accountId);
        const wallet = await backgroundApiProxy.engine.getWallet(walletId);
        const value = new BigNumber(amount)
          .shiftedBy(tokenInfo.decimals)
          .toFixed(0);
        let needApproved = false;
        let approveTx: IEncodedTxEvm | undefined;
        const stakingTx: StakingTransactionData =
          await backgroundApiProxy.serviceStaking.buildTxForStakingMaticToLido({
            amount: value,
            networkId,
            accountId,
          });
        const allowance = await backgroundApiProxy.engine.getTokenAllowance({
          networkId,
          accountId,
          tokenIdOnNetwork: maticTokenAddress,
          spender: stakingTx.to,
        });
        if (allowance) {
          needApproved = new BigNumber(
            getTokenAmountString(tokenInfo, allowance),
          ).lt(value);
        }

        if (needApproved) {
          approveTx =
            (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
              spender: stakingTx.to,
              networkId,
              accountId,
              token: maticTokenAddress,
              amount,
            })) as IEncodedTxEvm;
        }

        const tasks: Task[] = [];

        const doSwap = async () => {
          const account = await backgroundApiProxy.engine.getAccount(
            accountId,
            networkId,
          );
          const encodedTx = {
            ...stakingTx,
            from: account.address,
          };
          await sendTx({
            accountId,
            networkId,
            gasEstimateFallback: true,
            encodedTx: encodedTx as IEncodedTxEvm,
            showSendFeedbackReceipt: true,
            // eslint-disable-next-line
            onSuccess: async ({ result, decodedTx }) => {
              ToastManager.show({
                title: intl.formatMessage({ id: 'msg__success' }),
              });
              backgroundApiProxy.dispatch(
                addTransaction({
                  accountId: account.id,
                  networkId,
                  transaction: {
                    hash: result.txid,
                    accountId: account.id,
                    networkId,
                    type: 'lidoStakeMatic',
                    nonce: decodedTx?.nonce,
                    addedTime: Date.now(),
                  },
                }),
              );
            },
            onFail: () => {
              appUIEventBus.emit(AppUIEventBusNames.SwapError);
            },
          });
        };

        tasks.unshift(doSwap);

        if (approveTx) {
          const doApprove = async (nextTask?: Task) => {
            await sendTx({
              accountId,
              networkId,
              encodedTx: approveTx as IEncodedTxEvm,
              onSuccess: async () => {
                if (wallet.type === 'hw') {
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.Send,
                    params: {
                      screen: SendModalRoutes.HardwareSwapContinue,
                      params: {
                        networkId,
                        accountId,
                      },
                    },
                  });
                }
                await nextTask?.();
              },
            });
          };
          tasks.unshift(doApprove);
        }
        onClose?.();
        await combinedTasks(tasks);
        navigation.goBack();
      } catch (e) {
        ToastManager.show(
          { title: (e as Error).message },
          { type: ToastManagerType.error },
        );
        return;
      } finally {
        setLoading(false);
      }
    },
    [
      tokenInfo,
      networkId,
      accountId,
      amount,
      maticTokenAddress,
      sendTx,
      navigation,
      intl,
    ],
  );

  return (
    <Modal
      header={intl.formatMessage(
        { id: 'title__stake_str' },
        { '0': tokenInfo?.symbol.toUpperCase() },
      )}
      primaryActionTranslationId="action__stake"
      hideSecondaryAction
      primaryActionProps={{
        isLoading: loading,
        isDisabled:
          !!errorMsg || !!minAmountErrMsg || new BigNumber(amount).lte(0),
      }}
      onPrimaryActionPress={onPrimaryActionPress}
    >
      <Box flex="1">
        <Box flex="1" flexDirection="column" justifyContent="space-between">
          <Center flex="1" flexDirection="column" justifyContent="space-around">
            <Center flexGrow="1" maxH="140px">
              <Text
                textAlign="center"
                typography="DisplayLarge"
                color="text-subdued"
              >
                {tokenInfo?.symbol.toUpperCase() ?? ''}
              </Text>
              <Center flex="1" minH="30px">
                <AutoSizeText
                  autoFocus
                  text={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                />
              </Center>
              <Center>
                {minAmountErrMsg ? (
                  <Typography.Body1Strong color="text-critical">
                    {minAmountErrMsg}
                  </Typography.Body1Strong>
                ) : (
                  <FormatCurrency
                    numbers={[mainPrice ?? 0, amount ?? 0]}
                    render={(ele) => (
                      <Typography.Body2 color="text-subdued">
                        {mainPrice ? ele : '$ 0'}
                      </Typography.Body2>
                    )}
                  />
                )}
              </Center>
            </Center>
            <Center flexGrow="0.5" flexShrink="1" flexDirection="column">
              <Box h="1" flexShrink="1" />
              <HStack flexDirection="row" alignItems="center" space="3">
                <Button size="sm" onPress={() => userInput(25)}>
                  25%
                </Button>
                <Button size="sm" onPress={() => userInput(50)}>
                  50%
                </Button>
                <Button size="sm" onPress={() => userInput(75)}>
                  75%
                </Button>
                <Button size="sm" onPress={() => userInput(100)}>
                  {intl.formatMessage({ id: 'action__max' })}
                </Button>
              </HStack>
              <Box h="1" flexShrink="1" />
              <Box
                h="8"
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
              >
                <Typography.Body2 color="text-subdued" mr="1">
                  {intl.formatMessage({ id: 'content__available_balance' })}
                </Typography.Body2>
                <Typography.Body2Strong
                  color={errorMsg && amount ? 'text-critical' : 'text-default'}
                >
                  {formatAmount(tokenBalance ?? '', 6)}{' '}
                  {tokenInfo?.symbol.toUpperCase()}
                </Typography.Body2Strong>
              </Box>
            </Center>
            <Box w="full" flexGrow="0.5" flexShrink="1">
              <Box
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                h="10"
              >
                <Typography.Body2 color="text-subdued">
                  {intl.formatMessage({ id: 'form__apy' })}
                </Typography.Body2>
                <Typography.Body2 color="text-success">4.3%</Typography.Body2>
              </Box>
              {overview?.maticToStMaticRate ? (
                <Box
                  flexDirection="row"
                  justifyContent="space-between"
                  alignItems="center"
                  h="10"
                >
                  <Typography.Body2 color="text-subdued">
                    {intl.formatMessage({ id: 'form__rate' })}
                  </Typography.Body2>
                  <Typography.Body2>
                    1 Matic = {formatAmount(overview.maticToStMaticRate, 4)}{' '}
                    stMatic
                  </Typography.Body2>
                </Box>
              ) : null}
              {overview?.maticToStMaticRate && amount ? (
                <Box
                  flexDirection="row"
                  justifyContent="space-between"
                  alignItems="center"
                  h="10"
                >
                  <Typography.Body2 color="text-subdued">
                    {intl.formatMessage({ id: 'form__you_receive' })}
                  </Typography.Body2>
                  <Typography.Body2>
                    {formatAmount(
                      multiply(overview.maticToStMaticRate, amount),
                      4,
                    )}{' '}
                    stMatic
                  </Typography.Body2>
                </Box>
              ) : null}
            </Box>
          </Center>
        </Box>
        <StakingKeyboard text={amount} onTextChange={setAmount} />
      </Box>
    </Modal>
  );
}
