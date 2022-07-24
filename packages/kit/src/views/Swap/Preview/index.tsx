import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Icon,
  Modal,
  Typography,
  VStack,
  useToast,
} from '@onekeyhq/components';
import { Account as BaseAccount } from '@onekeyhq/engine/src/types/account';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { ISwapInfo } from '@onekeyhq/engine/src/vaults/types';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../hooks';
import {
  setApprovalSubmitted,
  setReceiving,
} from '../../../store/reducers/swap';
import { addTransaction } from '../../../store/reducers/swapTransactions';
import { SendRoutes, SendRoutesParams } from '../../Send/types';
import NetworkToken from '../components/NetworkToken';
import TransactionRate from '../components/TransactionRate';
import {
  useReceivingAddress,
  useSwap,
  useSwapQuoteRequestParams,
  useSwapState,
} from '../hooks/useSwap';
import { SwapQuoter } from '../quoter';
import { FetchQuoteParams, QuoteData, QuoterType } from '../typings';
import { TokenAmount, formatAmount, isNoCharge } from '../utils';

import { Timer } from './Timer';

type NavigationProps = ModalScreenProps<SendRoutesParams>;

function convertToSwapInfo(options: {
  swapQuote: QuoteData;
  quoteParams: FetchQuoteParams;
  inputAmount: TokenAmount;
  outputAmount: TokenAmount;
  account: BaseAccount;
}): ISwapInfo {
  const { swapQuote, quoteParams, inputAmount, outputAmount, account } =
    options;
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

const isCrosschainQuote = (data?: QuoteData): boolean => {
  if (!data) {
    return false;
  }
  const channels: QuoterType[] = [QuoterType.socket, QuoterType.swftc];
  return data.type && channels.includes(data.type);
};

const Preview = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const swapSlippagePercent = useAppSelector(
    (s) => s.settings.swapSlippagePercent,
  );
  const { address } = useReceivingAddress();
  const { account, network } = useActiveWalletAccount();
  const { inputToken, outputToken, inputTokenNetwork, outputTokenNetwork } =
    useSwapState();
  const { inputAmount, outputAmount, swapQuote } = useSwap();
  const params = useSwapQuoteRequestParams();
  const receivingAddress = isCrosschainQuote(swapQuote) ? address : undefined;

  const onSubmit = useCallback(async () => {
    if (
      !params ||
      !account ||
      !network ||
      !inputAmount ||
      !swapQuote ||
      !outputAmount
    ) {
      return;
    }
    const swapInfo = convertToSwapInfo({
      quoteParams: params,
      inputAmount,
      outputAmount,
      swapQuote,
      account,
    });
    const res = await SwapQuoter.client.buildTransaction(swapQuote.type, {
      ...params,
      activeAccount: account,
      activeNetwok: network,
      receivingAddress,
      txData: swapQuote.txData,
      txAttachment: swapQuote.txAttachment,
    });
    if (res?.data) {
      const encodedTx: IEncodedTxEvm = {
        ...res?.data,
        from: account.address,
      };
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            payloadInfo: {
              type: 'InternalSwap',
              swapInfo,
            },
            feeInfoEditable: true,
            feeInfoUseFeeInTx: false,
            encodedTx,
            onSuccess: (tx, data) => {
              if (
                inputAmount &&
                inputTokenNetwork &&
                outputAmount &&
                outputTokenNetwork
              ) {
                backgroundApiProxy.dispatch(
                  addTransaction({
                    accountId: account.id,
                    networkId: network.id,
                    transaction: {
                      hash: tx.txid,
                      from: account.address,
                      addedTime: Date.now(),
                      status: 'pending',
                      type: 'swap',
                      accountId: account.id,
                      networkId: network.id,
                      quoterType: swapQuote.type,
                      nonce: data?.decodedTx?.nonce,
                      attachment: res.attachment,
                      receivingAddress,
                      tokens: {
                        rate: Number(swapQuote.instantRate),
                        from: {
                          networkId: inputTokenNetwork.id,
                          token: inputAmount.token,
                          amount: inputAmount.typedValue,
                        },
                        to: {
                          networkId: outputTokenNetwork.id,
                          token: outputAmount.token,
                          amount: outputAmount.typedValue,
                        },
                      },
                    },
                  }),
                );
                backgroundApiProxy.dispatch(setApprovalSubmitted(false));
                backgroundApiProxy.dispatch(
                  setReceiving({ address: undefined, name: undefined }),
                );
              }
            },
          },
        },
      });
    } else {
      const msg =
        res?.error?.msg ?? intl.formatMessage({ id: 'msg__unknown_error' });
      toast.show({ title: msg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, account, network, swapQuote, addTransaction]);
  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__preview' })}
      hideSecondaryAction
      primaryActionProps={{ onPromise: onSubmit }}
      primaryActionTranslationId="title__swap"
    >
      <Box>
        <Box
          borderColor="border-subdued"
          borderWidth="0.5"
          borderRadius="12"
          background="surface-neutral-subdued"
          p="4"
        >
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box flex="1">
              <Typography.DisplayMedium>
                {formatAmount(inputAmount?.value, 4)}
              </Typography.DisplayMedium>
            </Box>
            <Box flexDirection="row" alignItems="center">
              <NetworkToken
                token={inputToken}
                networkId={inputTokenNetwork?.id}
              />
              <Typography.Body1 ml="3">
                {inputToken?.symbol.toString()}
              </Typography.Body1>
            </Box>
          </Box>
          <Box
            h="5"
            w="full"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box mr="4">
              <Icon name="ArrowDownSolid" size={16} />
            </Box>
            <Divider flex="1" />
          </Box>
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box flex="1">
              <Typography.DisplayMedium>
                {formatAmount(outputAmount?.value, 4)}
              </Typography.DisplayMedium>
            </Box>
            <Box flexDirection="row" alignItems="center">
              <NetworkToken
                token={outputToken}
                networkId={outputTokenNetwork?.id}
              />
              <Typography.Body1 ml="3">
                {outputToken?.symbol.toUpperCase()}
              </Typography.Body1>
            </Box>
          </Box>
        </Box>
        <Box my="4">
          <Timer />
        </Box>
        <VStack space="1" mt="1">
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            minH="7"
          >
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__rate' })}
            </Typography.Body2>
            <Box flex="1" flexDirection="row" justifyContent="flex-end">
              <Box maxW="full">
                <TransactionRate
                  tokenA={inputToken}
                  tokenB={outputToken}
                  rate={swapQuote?.instantRate}
                />
              </Box>
            </Box>
          </Box>
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            h="9"
          >
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__slippage_tolerance' })}
            </Typography.Body2>
            <Typography.Body2>{swapSlippagePercent}%</Typography.Body2>
          </Box>
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            h="9"
          >
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__handling_fee' })}
            </Typography.Body2>
            <Typography.Body2>
              {swapQuote && !isNoCharge(swapQuote)
                ? '0.875%'
                : intl.formatMessage({ id: 'content__no_charge' })}
            </Typography.Body2>
          </Box>
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            h="9"
          >
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'title__channel' })}
            </Typography.Body2>
            <Typography.Body2>{swapQuote?.type}</Typography.Body2>
          </Box>
        </VStack>
      </Box>
    </Modal>
  );
};

export default Preview;
