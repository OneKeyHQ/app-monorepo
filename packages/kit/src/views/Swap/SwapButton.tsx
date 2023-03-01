/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useRef, useState } from 'react';
import type { FC } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Button,
  Center,
  HStack,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import type { Account as BaseAccount } from '@onekeyhq/engine/src/types/account';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { IEncodedTx, ISwapInfo } from '@onekeyhq/engine/src/vaults/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../hooks';
import { useActiveWalletAccount, useAppSelector } from '../../hooks/redux';
import { ModalRoutes, RootRoutes } from '../../routes/types';
import { addTransaction } from '../../store/reducers/swapTransactions';
import { deviceUtils } from '../../utils/hardware';
import { wait } from '../../utils/helper';
import { canShowAppReview, openAppReview } from '../../utils/openAppReview';
import { showOverlay } from '../../utils/overlayUtils';
import { SendRoutes } from '../Send/types';

import { reservedNetworkFee } from './config';
import {
  useDerivedSwapState,
  useInputLimitsError,
  useSwapError,
  useSwapQuoteRequestParams,
} from './hooks/useSwap';
import { SwapQuoter } from './quoter';
import { dangerRefs } from './refs';
import { SwapError, SwapRoutes } from './typings';
import {
  formatAmount,
  getTokenAmountString,
  getTokenAmountValue,
} from './utils';

import type {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  QuoteData,
  TransactionToken,
} from './typings';
import type { TokenAmount } from './utils';

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

const ExchangeButton = () => {
  const intl = useIntl();

  const ref = useRef(false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const networks = useAppSelector((s) => s.runtime.networks);
  const quote = useAppSelector((s) => s.swap.quote);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  const recipient = useAppSelector((s) => s.swap.recipient);
  const validationSetting = useAppSelector((s) => s.settings.validationSetting);
  const { inputAmount, outputAmount } = useDerivedSwapState();
  const params = useSwapQuoteRequestParams();
  const disableSwapExactApproveAmount = useAppSelector(
    (s) => s.settings.disableSwapExactApproveAmount,
  );

  const onSubmit = useCallback(async () => {
    if (!params || !sendingAccount || !quote || !inputAmount || !outputAmount) {
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__unknown_error' }),
      });
      return;
    }

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

    const targetNetworkId = inputAmount.token.networkId;

    const targetNetwork = networks.find((item) => item.id === targetNetworkId);
    if (!targetNetwork) {
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__unknown_error' }),
      });
      return;
    }

    if (!params.tokenIn.tokenIdOnNetwork) {
      const [result] = await backgroundApiProxy.serviceToken.fetchTokenBalance({
        accountId: sendingAccount.id,
        networkId: targetNetwork.id,
      });
      const balance = new BigNumber(result?.main?.balance ?? '0');
      const reservedValue = reservedNetworkFee[targetNetwork.id] ?? 0.1;
      if (balance.minus(inputAmount.typedValue).lt(reservedValue)) {
        ToastManager.show({
          title: intl.formatMessage(
            { id: 'msg__gas_fee_is_not_enough_please_keep_at_least_str' },
            { '0': `${reservedValue} ${params.tokenIn.symbol.toUpperCase()}` },
          ),
        });
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
      res = await SwapQuoter.client.buildTransaction(quote.type, buildParams);
    } catch (e: any) {
      const title = e?.response?.data?.message || e.message;
      ToastManager.show({ title }, { type: 'error' });
      return;
    }

    if (res === undefined || !res?.data) {
      const title =
        res?.error?.msg ?? intl.formatMessage({ id: 'msg__unknown_error' });
      ToastManager.show({ title });
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
      const allowance = await backgroundApiProxy.engine.getTokenAllowance({
        networkId: params.tokenIn.networkId,
        accountId: params.activeAccount.id,
        tokenIdOnNetwork: params.tokenIn.tokenIdOnNetwork,
        spender: newQuote.allowanceTarget,
      });
      if (allowance) {
        needApproved = new BigNumber(
          getTokenAmountString(params.tokenIn, allowance),
        ).lt(newQuote.sellAmount);
      }

      const needCancelApproval =
        needApproved &&
        ((targetNetworkId === OnekeyNetwork.eth &&
          params.tokenIn.tokenIdOnNetwork.toLowerCase() ===
            '0xdac17f958d2ee523a2206206994597c13d831ec7') ||
          (targetNetworkId === OnekeyNetwork.heco &&
            params.tokenIn.tokenIdOnNetwork.toLowerCase() ===
              '0x897442804e4c8ac3a28fadb217f08b401411183e')) &&
        Number(allowance || '0') > 0;
      if (needCancelApproval) {
        cancelApproveTx =
          (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
            spender: newQuote.allowanceTarget,
            networkId: params.tokenIn.networkId,
            accountId: sendingAccount.id,
            token: inputAmount.token.tokenIdOnNetwork,
            amount: '0',
          })) as IEncodedTxEvm;
      }

      if (needApproved) {
        const amount = disableSwapExactApproveAmount
          ? 'unlimited'
          : getTokenAmountValue(
              inputAmount.token,
              newQuote.sellAmount,
            ).toFixed();

        approveTx = (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
          spender: newQuote.allowanceTarget,
          networkId: params.tokenIn.networkId,
          accountId: sendingAccount.id,
          token: inputAmount.token.tokenIdOnNetwork,
          amount,
        })) as IEncodedTxEvm;

        if (cancelApproveTx && cancelApproveTx.nonce) {
          approveTx.nonce = Number(cancelApproveTx.nonce) + 1;
        }
      }
    }

    const addSwapTransaction = async (hash: string, nonce?: number) => {
      if (res === undefined) {
        return;
      }
      const from: TransactionToken = {
        networkId: inputAmount.token.networkId,
        token: inputAmount.token,
        amount:
          formatAmount(
            new BigNumber(newQuote.sellAmount).shiftedBy(
              -inputAmount.token.decimals,
            ),
          ) || inputAmount.typedValue,
      };
      const to: TransactionToken = {
        networkId: outputAmount.token.networkId,
        token: outputAmount.token,
        amount:
          formatAmount(
            new BigNumber(newQuote.buyAmount).shiftedBy(
              -outputAmount.token.decimals,
            ),
          ) || outputAmount.typedValue,
      };
      backgroundApiProxy.dispatch(
        addTransaction({
          accountId: sendingAccount.id,
          networkId: targetNetwork.id,
          transaction: {
            hash,
            from: sendingAccount.address,
            addedTime: Date.now(),
            status: 'pending',
            type: 'swap',
            accountId: sendingAccount.id,
            networkId: targetNetwork.id,
            quoterType: quote.type,
            nonce,
            attachment: res.attachment,
            receivingAddress: recipient?.address,
            providers: newQuote?.sources ?? quote.providers,
            arrivalTime: quote.arrivalTime,
            percentageFee: quote.percentageFee,
            tokens: {
              from,
              to,
              rate: Number(res?.result?.instantRate ?? quote.instantRate),
            },
          },
        }),
      );
      backgroundApiProxy.serviceSwap.clearState();
      backgroundApiProxy.serviceSwap.resetSwapSlippage();
      backgroundApiProxy.serviceToken.addAccountToken(
        inputAmount.token.networkId,
        sendingAccount.id,
        inputAmount.token.tokenIdOnNetwork,
      );
      if (inputAmount.token.networkId === outputAmount.token.networkId) {
        backgroundApiProxy.serviceToken.addAccountToken(
          outputAmount.token.networkId,
          sendingAccount.id,
          outputAmount.token.tokenIdOnNetwork,
        );
      }
      if (res.result?.quoter === 'swftc' && res.attachment?.swftcOrderId) {
        SwapQuoter.client.swftModifyTxId(res.attachment?.swftcOrderId, hash);
      }
      const fromNetworkName = networks.find(
        (item) => item.id === from.networkId,
      )?.shortName;
      const toNetworkName = networks.find(
        (item) => item.id === to.networkId,
      )?.shortName;
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
        params: buildParams,
        response: res,
      });
      const show = await canShowAppReview();
      if (show) {
        await wait(2000);
        openAppReview();
      }
    };

    const main = async (options?: { skipSendFeedbackReceipt?: boolean }) => {
      try {
        if (wallet.type === 'hw') {
          if (approveTx) {
            await backgroundApiProxy.serviceSwap.sendTransaction({
              accountId: sendingAccount.id,
              networkId: targetNetworkId,
              encodedTx: approveTx,
              autoFallback: Boolean(cancelApproveTx),
            });
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendRoutes.HardwareSwapContinue,
                params: {
                  networkId: targetNetworkId,
                  accountId: sendingAccount.id,
                },
              },
            });
          }
          try {
            const { result, decodedTx } =
              await backgroundApiProxy.serviceSwap.sendTransaction({
                accountId: sendingAccount.id,
                networkId: targetNetworkId,
                autoFallback: true,
                encodedTx: encodedTx as IEncodedTxEvm,
                payload: {
                  type: 'InternalSwap',
                  swapInfo,
                },
              });
            addSwapTransaction(result.txid, decodedTx.nonce);
            appUIEventBus.emit(AppUIEventBusNames.SwapCompleted);
          } catch (e: any) {
            deviceUtils.showErrorToast(e, e?.data?.message || e.message);
            appUIEventBus.emit(AppUIEventBusNames.SwapError);
          }
        } else if (wallet.type === 'external') {
          const sendTx = () => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendRoutes.SendConfirm,
                params: {
                  accountId: sendingAccount.id,
                  networkId: targetNetworkId,
                  payloadInfo: {
                    type: 'InternalSwap',
                    swapInfo,
                  },
                  feeInfoEditable: true,
                  feeInfoUseFeeInTx: false,
                  encodedTx,
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
                  onSuccess: (tx, data) => {
                    addSwapTransaction(tx.txid, data?.decodedTx?.nonce);
                  },
                },
              },
            });
          };
          if (approveTx) {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendRoutes.SendConfirm,
                params: {
                  accountId: sendingAccount.id,
                  networkId: targetNetworkId,
                  payloadInfo: {
                    type: 'InternalSwap',
                  },
                  feeInfoEditable: true,
                  feeInfoUseFeeInTx: false,
                  encodedTx: approveTx,
                  onSuccess: sendTx,
                },
              },
            });
          } else {
            sendTx();
          }
        } else {
          const password =
            await backgroundApiProxy.servicePassword.getPassword();
          if (password && !validationSetting?.Payment) {
            if (approveTx) {
              await backgroundApiProxy.serviceSwap.sendTransaction({
                accountId: sendingAccount.id,
                networkId: targetNetworkId,
                encodedTx: approveTx,
                autoFallback: Boolean(cancelApproveTx),
              });
            }
            const { result, decodedTx } =
              await backgroundApiProxy.serviceSwap.sendTransaction({
                accountId: sendingAccount.id,
                networkId: targetNetworkId,
                autoFallback: !!approveTx,
                encodedTx: encodedTx as IEncodedTxEvm,
                payload: {
                  type: 'InternalSwap',
                  swapInfo,
                },
              });
            addSwapTransaction(result.txid, decodedTx.nonce);
            if (options?.skipSendFeedbackReceipt) {
              return;
            }
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendRoutes.SendFeedbackReceipt,
                params: {
                  networkId: targetNetworkId,
                  accountId: sendingAccount.id,
                  txid: result.txid,
                  type: 'Send',
                },
              },
            });
          } else {
            if (approveTx !== undefined) {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Send,
                params: {
                  screen: SendRoutes.SendConfirm,
                  params: {
                    accountId: sendingAccount.id,
                    networkId: targetNetworkId,
                    feeInfoEditable: true,
                    feeInfoUseFeeInTx: false,
                    encodedTx: approveTx,
                    payloadInfo: {
                      type: 'InternalSwap',
                      swapInfo: { ...swapInfo, isApprove: true },
                    },
                    onSuccess: async () => {
                      const { result, decodedTx } =
                        await backgroundApiProxy.serviceSwap.sendTransaction({
                          accountId: sendingAccount.id,
                          networkId: targetNetworkId,
                          encodedTx: encodedTx as IEncodedTxEvm,
                          autoFallback: true,
                          payload: {
                            type: 'InternalSwap',
                            swapInfo,
                          },
                        });
                      addSwapTransaction(result.txid, decodedTx.nonce);
                    },
                  },
                },
              });
              return;
            }
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendRoutes.SendConfirm,
                params: {
                  accountId: sendingAccount.id,
                  networkId: targetNetworkId,
                  feeInfoEditable: true,
                  feeInfoUseFeeInTx: false,
                  encodedTx: encodedTx as IEncodedTxEvm,
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
                  onSuccess: (tx, data) => {
                    addSwapTransaction(tx.txid, data?.decodedTx?.nonce);
                  },
                },
              },
            });
          }
        }
      } catch (e: any) {
        deviceUtils.showErrorToast(e, e?.data?.message || e.message);
      }
    };

    if (cancelApproveTx !== undefined) {
      const onCancelApprovalSubmit = async () => {
        try {
          if (wallet.type === 'hw') {
            await backgroundApiProxy.serviceSwap.sendTransaction({
              accountId: sendingAccount.id,
              networkId: targetNetworkId,
              encodedTx: cancelApproveTx as IEncodedTxEvm,
            });
            await main();
          } else if (wallet.type === 'external') {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendRoutes.SendConfirm,
                params: {
                  accountId: sendingAccount.id,
                  networkId: targetNetworkId,
                  payloadInfo: {
                    type: 'InternalSwap',
                  },
                  feeInfoEditable: true,
                  feeInfoUseFeeInTx: false,
                  encodedTx: cancelApproveTx,
                  onSuccess: () => main(),
                },
              },
            });
          } else {
            const password =
              await backgroundApiProxy.servicePassword.getPassword();
            if (password && !validationSetting?.Payment) {
              await backgroundApiProxy.serviceSwap.sendTransaction({
                accountId: sendingAccount.id,
                networkId: targetNetworkId,
                encodedTx: cancelApproveTx as IEncodedTxEvm,
              });
              await main();
            } else {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Send,
                params: {
                  screen: SendRoutes.SendConfirm,
                  params: {
                    accountId: sendingAccount.id,
                    networkId: targetNetworkId,
                    feeInfoEditable: true,
                    feeInfoUseFeeInTx: false,
                    encodedTx: cancelApproveTx as IEncodedTxEvm,
                    payloadInfo: {
                      type: 'InternalSwap',
                      swapInfo: { ...swapInfo, isApprove: true },
                    },
                    onSuccess: () => main({ skipSendFeedbackReceipt: true }),
                  },
                },
              });
            }
          }
        } catch (e: any) {
          deviceUtils.showErrorToast(e, e?.data?.message || e.message);
        }
      };
      showOverlay((close) => (
        <SwapTransactionsCancelApprovalBottomSheetModal
          close={close}
          onSubmit={onCancelApprovalSubmit}
        />
      ));
    } else {
      await main();
    }
    await wait(1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params,
    quote,
    sendingAccount,
    inputAmount,
    outputAmount,
    addTransaction,
    disableSwapExactApproveAmount,
    recipient?.address,
    validationSetting,
  ]);

  const onPress = useCallback(async () => {
    if (ref.current) {
      return;
    }
    setLoading(true);
    ref.current = true;
    try {
      dangerRefs.submited = true;
      await onSubmit();
    } finally {
      ref.current = false;
      dangerRefs.submited = false;
      setLoading(false);
    }
  }, [onSubmit]);

  return (
    <Button
      key="submit"
      size="xl"
      type="primary"
      isLoading={loading}
      isDisabled={!quote || !recipient}
      onPress={onPress}
    >
      {intl.formatMessage({ id: 'title__swap' })}
    </Button>
  );
};

const SwapStateButton = () => {
  const intl = useIntl();
  const inputToken = useAppSelector((s) => s.swap.inputToken);
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

const SwapButton = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const swapMaintain = useAppSelector((s) => s.swapTransactions.swapMaintain);
  const { wallet } = useActiveWalletAccount();

  const onCreateWallet = useCallback(() => {
    navigation.navigate(RootRoutes.Onboarding);
  }, [navigation]);

  if (!wallet) {
    return (
      <Button size="xl" type="primary" onPress={onCreateWallet} key="addWallet">
        {intl.formatMessage({ id: 'action__create_wallet' })}
      </Button>
    );
  }

  if (swapMaintain) {
    return (
      <Button size="xl" type="primary" isDisabled key="swapMaintain">
        {intl.formatMessage({ id: 'action__under_maintaince' })}
      </Button>
    );
  }

  return <SwapStateButton />;
};

export default SwapButton;
