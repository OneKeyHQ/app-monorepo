/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useRef, useState } from 'react';
import type { ComponentProps, FC } from 'react';

import BigNumber from 'bignumber.js';
import { LinearGradient } from 'expo-linear-gradient';
import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Button,
  Center,
  HStack,
  Pressable,
  ToastManager,
  Token as TokDisplay,
  Typography,
} from '@onekeyhq/components';
import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import type { Account as BaseAccount } from '@onekeyhq/engine/src/types/account';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IDecodedTx,
  IEncodedTx,
  ISwapInfo,
} from '@onekeyhq/engine/src/vaults/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import { useAppSelector } from '../../../../hooks/redux';
import { ModalRoutes, RootRoutes } from '../../../../routes/types';
import { addTransaction } from '../../../../store/reducers/swapTransactions';
import { wait } from '../../../../utils/helper';
import {
  canShowAppReview,
  openAppReview,
} from '../../../../utils/openAppReview';
import { showOverlay } from '../../../../utils/overlayUtils';
import { SendModalRoutes } from '../../../Send/types';
import {
  useCheckInputBalance,
  useInputLimitsError,
  useSwapError,
  useSwapQuoteRequestParams,
} from '../../hooks/useSwap';
import { useSwapSend } from '../../hooks/useSwapSend';
import { useTagLogger } from '../../hooks/useSwapUtils';
import { SwapQuoter } from '../../quoter';
import { dangerRefs } from '../../refs';
import { SwapError, SwapRoutes } from '../../typings';
import {
  TokenAmount,
  calculateDecodedTxNetworkFee,
  formatAmount,
  getTokenAmountString,
  getTokenAmountValue,
} from '../../utils';

import { combinedTasks } from './utils';

import type {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  QuoteData,
  Recipient,
  TransactionToken,
} from '../../typings';
import type { Task } from './utils';

type IConvertToSwapInfoOptions = {
  swapQuote: QuoteData;
  quoteParams: FetchQuoteParams;
  inputAmount: TokenAmount;
  outputAmount: TokenAmount;
  account: BaseAccount;
  receivingAddress?: string;
};

type SwapTransactionsCancelApprovalBottomSheetModalProps = {
  close: () => void;
  onSubmit: () => void;
};

enum TAGS {
  overview = 'overview',
  approval = 'approval',
  cancelApproval = 'cancelApproval',
  swap = 'swap',
  checkTokenBalance = 'checkTokenBalance',
  checkTokenAllowance = 'checkTokenAllowance',
  buildTransaction = 'buildTransaction',
}

const addSwapTransaction = async ({
  hash,
  decodedTx,
  params,
  response,
  recipient,
  quote,
}: {
  hash: string;
  decodedTx?: IDecodedTx;
  params: BuildTransactionParams;
  response: BuildTransactionResponse;
  recipient: Recipient;
  quote: QuoteData;
}) => {
  const newQuote = response?.result;
  if (response === undefined || newQuote === undefined) {
    return;
  }
  backgroundApiProxy.serviceSwap.clearState();
  const sellAmount = newQuote.sellAmount || quote.sellAmount;
  const buyAmount = newQuote.buyAmount || quote.buyAmount;
  const quoterType = quote.type;
  const quoterLogo = quote.quoterlogo;
  const fromNetwork = await backgroundApiProxy.engine.getNetwork(
    params.tokenIn.networkId,
  );
  const toNetwork = await backgroundApiProxy.engine.getNetwork(
    params.tokenIn.networkId,
  );
  const inputAmount = getTokenAmountValue(params.tokenIn, sellAmount);
  const outputAmount = getTokenAmountValue(params.tokenOut, buyAmount);
  const nonce = decodedTx?.nonce;

  let networkFee: string | undefined;
  if (decodedTx) {
    networkFee = calculateDecodedTxNetworkFee(decodedTx, fromNetwork);
  }

  const from: TransactionToken = {
    networkId: params.tokenIn.networkId,
    token: params.tokenIn,
    amount:
      formatAmount(
        new BigNumber(newQuote.sellAmount).shiftedBy(-params.tokenIn.decimals),
      ) || formatAmount(inputAmount),
  };
  const to: TransactionToken = {
    networkId: params.tokenOut.networkId,
    token: params.tokenOut,
    amount:
      formatAmount(
        new BigNumber(newQuote.buyAmount).shiftedBy(-params.tokenOut.decimals),
      ) || formatAmount(outputAmount),
  };
  backgroundApiProxy.dispatch(
    addTransaction({
      accountId: params.activeAccount.id,
      networkId: params.tokenIn.networkId,
      transaction: {
        hash,
        from: params.activeAccount.address,
        addedTime: Date.now(),
        status: 'pending',
        type: 'swap',
        accountId: params.activeAccount.id,
        networkId: params.tokenIn.networkId,
        quoterType,
        quoterLogo,
        nonce,
        attachment: response.attachment,
        receivingAccountId: recipient?.accountId,
        receivingAddress: recipient?.address,
        providers: newQuote?.sources ?? quote.providers,
        arrivalTime: quote.arrivalTime,
        percentageFee: quote.percentageFee,
        protocalFees: quote.protocolFees,
        networkFee,
        tokens: {
          from,
          to,
          rate: Number(newQuote?.instantRate ?? quote.instantRate),
        },
      },
    }),
  );

  backgroundApiProxy.serviceSwap.resetSwapSlippage();
  backgroundApiProxy.serviceToken.addAccountToken(
    params.tokenIn.networkId,
    params.activeAccount.id,
    params.tokenIn.tokenIdOnNetwork,
  );
  if (params.tokenIn.networkId === params.tokenOut.networkId) {
    backgroundApiProxy.serviceToken.addAccountToken(
      params.tokenOut.networkId,
      params.activeAccount.id,
      params.tokenOut.tokenIdOnNetwork,
    );
  }
  if (
    response.result?.quoter === 'swftc' &&
    response.attachment?.swftcOrderId
  ) {
    SwapQuoter.client.swftModifyTxId(response.attachment?.swftcOrderId, hash);
  }
  const fromNetworkName = fromNetwork?.shortName;
  const toNetworkName = toNetwork?.shortName;
  backgroundApiProxy.serviceSwap.addRecord({
    txid: hash,
    from: {
      networkId: from.networkId,
      networkName: fromNetworkName ?? '',
      tokenAddress: from.token.tokenIdOnNetwork,
      tokenName: from.token.name,
      amount: from.amount,
    },
    to: {
      networkId: to.networkId,
      networkName: toNetworkName ?? '',
      tokenAddress: to.token.tokenIdOnNetwork,
      tokenName: to.token.name,
      amount: to.amount,
    },
    params,
    response,
  });
  const show = await canShowAppReview();
  if (show) {
    await wait(2000);
    openAppReview();
  }
};

function convertToSwapInfo(options: IConvertToSwapInfoOptions): ISwapInfo {
  const {
    swapQuote,
    quoteParams,
    inputAmount,
    outputAmount,
    account,
    receivingAddress,
  } = options;
  const {
    networkIn,
    networkOut,
    tokenIn,
    tokenOut,
    slippagePercentage,
    independentField,
  } = quoteParams;
  const swapInfo: ISwapInfo = {
    accountAddress: account.address,
    receivingAddress,
    send: {
      networkId: networkIn.id,
      tokenInfo: tokenIn,
      amount: inputAmount.typedValue,
      amountValue: inputAmount.amount.toFixed(),
    },
    receive: {
      networkId: networkOut.id,
      tokenInfo: tokenOut,
      amount: outputAmount.typedValue,
      amountValue: outputAmount.amount.toFixed(),
    },
    slippagePercentage,
    independentField,
    swapQuote,
  };
  return swapInfo;
}

const SwapTransactionsCancelApprovalBottomSheetModal: FC<
  SwapTransactionsCancelApprovalBottomSheetModalProps
> = ({ close, onSubmit }) => {
  const intl = useIntl();
  const onPress = useCallback(() => {
    close();
    onSubmit();
  }, [close, onSubmit]);
  return (
    <BottomSheetModal closeOverlay={close} title="" showHeader={false}>
      <Center h="16">
        <Typography.Heading fontSize={60}> ℹ️ </Typography.Heading>
      </Center>
      <Typography.DisplayMedium mt="4">
        {intl.formatMessage(
          { id: 'msg__need_to_send_str_transactions_to_change_allowance' },
          { '0': '2' },
        )}
      </Typography.DisplayMedium>
      <Typography.Body1 color="text-subdued" my="4">
        {intl.formatMessage({
          id: 'msg__modifying_the_authorized_limit_of_usdt_requires_resetting_it_to_zero_first_so_two_authorization_transactions_may_be_initiated',
        })}
      </Typography.Body1>
      <HStack flexDirection="row" space="4">
        <Button size="xl" type="basic" onPress={close} flex="1">
          {intl.formatMessage({ id: 'action__cancel' })}
        </Button>
        <Button size="xl" type="primary" onPress={onPress} flex="1">
          {intl.formatMessage({ id: 'action__confirm' })}
        </Button>
      </HStack>
    </BottomSheetModal>
  );
};

type LinearGradientButtonProps = ComponentProps<typeof Button> & {
  tokenA: Token;
  tokenB: Token;
};

const LinearGradientButton: FC<LinearGradientButtonProps> = ({
  tokenA,
  tokenB,
  onPress,
}) => {
  const intl = useIntl();
  return (
    <Box h="50px" w="full" shadow="1" borderRadius="12" overflow="hidden">
      <LinearGradient
        colors={['rgba(18, 65, 232, 255)', 'rgba(17, 228, 54, 255)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          height: '100%',
          width: '100%',
          opacity: 1,
        }}
      >
        <Pressable
          w="full"
          h="full"
          flexDirection="row"
          justifyContent="center"
          alignItems="center"
          onPress={onPress}
        >
          <Box
            position="relative"
            w="10"
            h="10"
            justifyContent="center"
            alignItems="center"
          >
            <Box
              position="absolute"
              top="8px"
              left="8px"
              w="18px"
              h="18px"
              overflow="hidden"
              borderRadius="full"
              bg="border-default"
              justifyContent="center"
              alignItems="center"
            >
              <TokDisplay size="4" token={tokenA} />
            </Box>
            <Box
              position="absolute"
              top="16px"
              left="16px"
              w="18px"
              h="18px"
              overflow="hidden"
              borderRadius="full"
              bg="border-default"
              justifyContent="center"
              alignItems="center"
            >
              <TokDisplay size="4" token={tokenB} />
            </Box>
          </Box>
          <Typography.Button1>
            {intl.formatMessage({ id: 'form__cross_chain_swap' })}
          </Typography.Button1>
        </Pressable>
      </LinearGradient>
    </Box>
  );
};

type LinearGradientExchangeButtonProps = ComponentProps<typeof Button>;

const LinearGradientExchangeButton: FC<LinearGradientExchangeButtonProps> = ({
  isDisabled,
  isLoading,
  ...props
}) => {
  const tokenA = useAppSelector((s) => s.swap.inputToken);
  const tokenB = useAppSelector((s) => s.swap.outputToken);
  if (
    !isDisabled &&
    !isLoading &&
    tokenA &&
    tokenB &&
    tokenA.networkId !== tokenB?.networkId
  ) {
    return <LinearGradientButton tokenA={tokenA} tokenB={tokenB} {...props} />;
  }
  return <Button isDisabled={isDisabled} isLoading={isLoading} {...props} />;
};

const ExchangeButton = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const ref = useRef(false);
  const [loading, setLoading] = useState(false);
  const quote = useAppSelector((s) => s.swap.quote);
  const params = useSwapQuoteRequestParams();
  const disableSwapExactApproveAmount = useAppSelector(
    (s) => s.settings.disableSwapExactApproveAmount,
  );
  const tagLogger = useTagLogger();

  const sendSwapTx = useSwapSend();

  const onSubmit = useCallback(async () => {
    const recipient = await backgroundApiProxy.serviceSwap.getRecipient();
    if (!params || !quote || !recipient) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        },
        { type: 'error' },
      );
      return;
    }
    const sendingAccount = params.activeAccount;
    const inputAmount = new TokenAmount(
      params.tokenIn,
      getTokenAmountValue(params.tokenIn, quote.sellAmount).toFixed(),
    );
    const outputAmount = new TokenAmount(
      params.tokenOut,
      getTokenAmountValue(params.tokenOut, quote.buyAmount).toFixed(),
    );
    const accountInWallets =
      await backgroundApiProxy.serviceSwap.checkAccountInWallets(
        sendingAccount.id,
      );

    if (!accountInWallets) {
      ToastManager.show(
        {
          title: intl.formatMessage(
            { id: 'msg__account_deleted' },
            { '0': sendingAccount.name },
          ),
        },
        { type: 'error' },
      );
      return;
    }

    const fromNetworkId = params.tokenIn.networkId;

    const fromNetwork = await backgroundApiProxy.engine.getNetwork(
      fromNetworkId,
    );

    if (!fromNetwork) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        },
        { type: 'error' },
      );
      return;
    }

    if (!params.tokenIn.tokenIdOnNetwork) {
      tagLogger.start(TAGS.checkTokenBalance);
      const [result] =
        await backgroundApiProxy.serviceToken.getAccountBalanceFromRpc(
          fromNetwork.id,
          sendingAccount.id,
          [],
          true,
        );
      tagLogger.end(TAGS.checkTokenBalance);
      const balance = new BigNumber(result?.main?.balance ?? '0');
      const reservedValue =
        await backgroundApiProxy.serviceSwap.getReservedNetworkFee(
          fromNetwork.id,
        );
      if (balance.minus(inputAmount.typedValue).lt(reservedValue)) {
        ToastManager.show(
          {
            title: intl.formatMessage(
              { id: 'msg__gas_fee_is_not_enough_please_keep_at_least_str' },
              {
                '0': `${reservedValue} ${params.tokenIn.symbol.toUpperCase()}`,
              },
            ),
          },
          { type: 'error' },
        );
        return;
      }
    }

    let res: BuildTransactionResponse | undefined;
    const buildParams: BuildTransactionParams = {
      ...params,
      activeAccount: sendingAccount,
      receivingAddress: recipient?.address,
      txData: quote.txData,
      additionalParams: quote.additionalParams,
      sellAmount: quote.sellAmount,
      buyAmount: quote.buyAmount,
      disableValidate: true,
    };
    try {
      tagLogger.start(TAGS.buildTransaction);
      res = await SwapQuoter.client.buildTransaction(quote.type, buildParams);
      tagLogger.end(TAGS.buildTransaction);
    } catch (e: any) {
      const title = e?.response?.data?.message || e.message;
      ToastManager.show({ title }, { type: 'error' });
      return;
    }

    if (res === undefined || !res?.data) {
      const title =
        res?.error?.msg ?? intl.formatMessage({ id: 'msg__unknown_error' });
      ToastManager.show({ title }, { type: 'error' });
      return;
    }

    const swapInfo = convertToSwapInfo({
      quoteParams: params,
      inputAmount,
      outputAmount,
      swapQuote: quote,
      account: sendingAccount,
      receivingAddress: recipient?.address,
    });

    let encodedTx: IEncodedTx | undefined;
    if (typeof res?.data === 'object') {
      // @ts-expect-error
      encodedTx = {
        ...res?.data,
        // SUI Transaction: error TS2322
        from: sendingAccount.address,
      };
    } else {
      encodedTx = res.data;
    }

    if (encodedTx === undefined) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        },
        { type: 'error' },
      );
      return;
    }

    const newQuote = res.result;

    if (!newQuote) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        },
        { type: 'error' },
      );
      return;
    }

    const walletId = getWalletIdFromAccountId(sendingAccount.id);
    const wallet = await backgroundApiProxy.engine.getWallet(walletId);

    let needApproved = false;
    let approveTx: IEncodedTxEvm | undefined;
    let cancelApproveTx: IEncodedTxEvm | undefined;

    if (newQuote.allowanceTarget && params.tokenIn.tokenIdOnNetwork) {
      tagLogger.start(TAGS.checkTokenAllowance);
      const allowance = await backgroundApiProxy.engine.getTokenAllowance({
        networkId: params.tokenIn.networkId,
        accountId: params.activeAccount.id,
        tokenIdOnNetwork: params.tokenIn.tokenIdOnNetwork,
        spender: newQuote.allowanceTarget,
      });
      tagLogger.end(TAGS.checkTokenAllowance);
      if (allowance) {
        needApproved = new BigNumber(
          getTokenAmountString(params.tokenIn, allowance),
        ).lt(newQuote.sellAmount);
      }

      const needCancelApproval =
        needApproved &&
        ((fromNetworkId === OnekeyNetwork.eth &&
          params.tokenIn.tokenIdOnNetwork.toLowerCase() ===
            '0xdac17f958d2ee523a2206206994597c13d831ec7') ||
          (fromNetworkId === OnekeyNetwork.heco &&
            params.tokenIn.tokenIdOnNetwork.toLowerCase() ===
              '0x897442804e4c8ac3a28fadb217f08b401411183e')) &&
        Number(allowance || '0') > 0;
      if (needCancelApproval) {
        cancelApproveTx =
          (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
            spender: newQuote.allowanceTarget,
            networkId: params.tokenIn.networkId,
            accountId: sendingAccount.id,
            token: params.tokenIn.tokenIdOnNetwork,
            amount: '0',
          })) as IEncodedTxEvm;
      }

      if (needApproved) {
        const amount = disableSwapExactApproveAmount
          ? 'unlimited'
          : getTokenAmountValue(params.tokenIn, newQuote.sellAmount).toFixed();

        approveTx = (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
          spender: newQuote.allowanceTarget,
          networkId: params.tokenIn.networkId,
          accountId: sendingAccount.id,
          token: params.tokenIn.tokenIdOnNetwork,
          amount,
        })) as IEncodedTxEvm;

        if (cancelApproveTx && cancelApproveTx.nonce) {
          approveTx.nonce = Number(cancelApproveTx.nonce) + 1;
        }
      }
    }

    const tasks: Task[] = [];

    const doSwap = async () => {
      tagLogger.start(TAGS.swap);
      await sendSwapTx({
        accountId: sendingAccount.id,
        networkId: fromNetworkId,
        gasEstimateFallback: true,
        encodedTx: encodedTx as IEncodedTxEvm,
        showSendFeedbackReceipt: true,
        payloadInfo: {
          type: 'InternalSwap',
          swapInfo,
        },
        onDetail(txid) {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Swap,
            params: {
              screen: SwapRoutes.Transaction,
              params: {
                txid,
              },
            },
          });
        },
        onSuccess: async ({ result, decodedTx }) => {
          if (!res) {
            return;
          }
          await addSwapTransaction({
            hash: result.txid,
            decodedTx,
            params: buildParams,
            response: res,
            quote,
            recipient,
          });
          appUIEventBus.emit(AppUIEventBusNames.SwapCompleted);
        },
        onFail: () => {
          appUIEventBus.emit(AppUIEventBusNames.SwapError);
        },
      });
      tagLogger.end(TAGS.swap);
    };

    tasks.unshift(doSwap);

    if (approveTx) {
      const doApprove = async (nextTask?: Task) => {
        const payloadInfo: any = { type: 'InternalSwap' };
        if (wallet.type !== 'external') {
          payloadInfo.swapInfo = { ...swapInfo, isApprove: true };
        }
        tagLogger.start(TAGS.approval);
        await sendSwapTx({
          accountId: sendingAccount.id,
          networkId: fromNetworkId,
          payloadInfo,
          encodedTx: approveTx as IEncodedTxEvm,
          gasEstimateFallback: Boolean(cancelApproveTx),
          onSuccess: async () => {
            if (wallet.type === 'hw') {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Send,
                params: {
                  screen: SendModalRoutes.HardwareSwapContinue,
                  params: {
                    networkId: fromNetworkId,
                    accountId: sendingAccount.id,
                  },
                },
              });
            }
            await nextTask?.();
          },
        });
        tagLogger.end(TAGS.approval);
      };
      tasks.unshift(doApprove);
    }

    if (cancelApproveTx) {
      const doCancelApprove = async (nextTask?: Task) => {
        const payloadInfo: any = { type: 'InternalSwap' };
        if (wallet.type !== 'external') {
          payloadInfo.swapInfo = { ...swapInfo, isApprove: true };
        }
        tagLogger.start(TAGS.cancelApproval);
        await sendSwapTx({
          accountId: sendingAccount.id,
          networkId: fromNetworkId,
          payloadInfo,
          encodedTx: cancelApproveTx as IEncodedTxEvm,
          gasEstimateFallback: Boolean(cancelApproveTx),
          onSuccess: async () => {
            await nextTask?.();
          },
        });
        tagLogger.end(TAGS.cancelApproval);
      };
      tasks.unshift(doCancelApprove);
    }

    if (cancelApproveTx) {
      showOverlay((close) => (
        <SwapTransactionsCancelApprovalBottomSheetModal
          close={close}
          onSubmit={() => combinedTasks(tasks)}
        />
      ));
    } else {
      await combinedTasks(tasks);
    }
    await wait(1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, quote, disableSwapExactApproveAmount, tagLogger]);

  const onPress = useCallback(async () => {
    if (ref.current) {
      return;
    }
    setLoading(true);
    ref.current = true;
    tagLogger.clear();
    tagLogger.start(TAGS.overview);
    try {
      dangerRefs.submited = true;
      await onSubmit();
    } finally {
      tagLogger.end(TAGS.overview);
      ref.current = false;
      dangerRefs.submited = false;
      setLoading(false);
    }
  }, [onSubmit, tagLogger]);

  return (
    <LinearGradientExchangeButton
      key="submit"
      size="xl"
      type="primary"
      isLoading={loading}
      isDisabled={!quote}
      onPress={onPress}
    >
      {intl.formatMessage({ id: 'title__swap' })}
    </LinearGradientExchangeButton>
  );
};

const ExchangeStateButton = () => {
  const intl = useIntl();
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const quote = useAppSelector((s) => s.swap.quote);
  const loading = useAppSelector((s) => s.swap.loading);
  const error = useSwapError();
  const limitsError = useInputLimitsError();

  if (error) {
    if (error === SwapError.InsufficientBalance) {
      return (
        <Button
          size="xl"
          type="primary"
          isDisabled
          key="insufficient_balance_error"
        >
          {intl.formatMessage(
            { id: 'form__amount_invalid' },
            { '0': inputToken?.symbol },
          )}
        </Button>
      );
    }
    return (
      <Button size="xl" type="primary" isDisabled key="baseError">
        {intl.formatMessage({ id: 'title__swap' })}
      </Button>
    );
  }

  if (limitsError) {
    return (
      <Button size="xl" type="primary" isDisabled key="depositLimit">
        {intl.formatMessage({ id: 'title__swap' })}
      </Button>
    );
  }

  if (!quote) {
    return (
      <Button
        size="xl"
        type="primary"
        isDisabled
        key="noQuote"
        isLoading={loading}
      >
        {intl.formatMessage({ id: 'title__swap' })}
      </Button>
    );
  }

  if (loading) {
    return (
      <Button
        size="xl"
        type="primary"
        isDisabled
        isLoading={loading}
        key="loading"
      >
        {intl.formatMessage({ id: 'title__finding_the_best_channel' })}
      </Button>
    );
  }
  return <ExchangeButton />;
};

const WrapButton = () => {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const wrapperTxInfo = useAppSelector((s) => s.swap.quote?.wrapperTxInfo);
  const params = useSwapQuoteRequestParams();
  const sendTx = useSwapSend();
  const onSubmit = useCallback(async () => {
    if (params && wrapperTxInfo) {
      const { tokenIn, activeAccount } = params;
      setLoading(true);
      try {
        await sendTx({
          networkId: tokenIn.networkId,
          accountId: activeAccount.id,
          encodedTx: wrapperTxInfo.encodedTx,
          showSendFeedbackReceipt: true,
          onSuccess: async ({ result, decodedTx }) => {
            let networkFee: string | undefined;
            const targetNetwork = await backgroundApiProxy.engine.getNetwork(
              tokenIn.networkId,
            );
            if (decodedTx && targetNetwork) {
              networkFee = calculateDecodedTxNetworkFee(
                decodedTx,
                targetNetwork,
              );
            }
            backgroundApiProxy.dispatch(
              addTransaction({
                accountId: activeAccount.id,
                networkId: tokenIn.networkId,
                transaction: {
                  hash: result.txid,
                  from: activeAccount.address,
                  addedTime: Date.now(),
                  status: 'pending',
                  type: 'swap',
                  accountId: activeAccount.id,
                  networkId: tokenIn.networkId,
                  nonce: decodedTx?.nonce,
                  receivingAccountId: activeAccount.id,
                  receivingAddress: activeAccount.address,
                  actualReceived: params.typedValue,
                  arrivalTime: 30,
                  networkFee,
                  tokens: {
                    from: {
                      token: params.tokenIn,
                      networkId: tokenIn.networkId,
                      amount: params.typedValue,
                    },
                    to: {
                      token: params.tokenOut,
                      networkId: tokenIn.networkId,
                      amount: params.typedValue,
                    },
                    rate: 1,
                  },
                },
              }),
            );
            backgroundApiProxy.serviceSwap.clearState();
          },
        });
      } finally {
        setLoading(false);
      }
    }
  }, [params, sendTx, wrapperTxInfo]);
  if (params && wrapperTxInfo) {
    return (
      <Button
        size="xl"
        type="primary"
        key="baseError"
        onPress={onSubmit}
        isLoading={loading}
      >
        {wrapperTxInfo.type === 'Deposite'
          ? intl.formatMessage({ id: 'action__wrap' })
          : intl.formatMessage({ id: 'action__unwrap' })}
      </Button>
    );
  }
  return null;
};

const WrapStateButton = () => {
  const intl = useIntl();
  const balanceInfo = useCheckInputBalance();
  if (balanceInfo && balanceInfo.insufficient) {
    return (
      <Button
        size="xl"
        type="primary"
        isDisabled
        key="insufficient_balance_error"
      >
        {intl.formatMessage(
          { id: 'form__amount_invalid' },
          { '0': balanceInfo.token.symbol },
        )}
      </Button>
    );
  }
  return <WrapButton />;
};

export const SwapButton = () => {
  const wrapperTxInfo = useAppSelector((s) => s.swap.quote?.wrapperTxInfo);
  return wrapperTxInfo ? <WrapStateButton /> : <ExchangeStateButton />;
};

export const SwapMainButton = () => {
  const intl = useIntl();
  const swapMaintain = useAppSelector((s) => s.swapTransactions.swapMaintain);
  if (swapMaintain) {
    return (
      <Button size="xl" type="primary" isDisabled key="swapMaintain">
        {intl.formatMessage({ id: 'action__under_maintaince' })}
      </Button>
    );
  }
  return <SwapButton />;
};
