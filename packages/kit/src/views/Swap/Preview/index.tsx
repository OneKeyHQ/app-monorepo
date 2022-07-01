import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Icon,
  Modal,
  Token,
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

import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../hooks';
import { SendRoutes, SendRoutesParams } from '../../Send/types';
import { swapClient } from '../client';
import ExchangeRate from '../ExchangeRate';
import {
  useSwap,
  useSwapQuoteRequestParams,
  useSwapState,
} from '../hooks/useSwap';
import { useTransactionAdder } from '../hooks/useTransactions';
import { QuoteParams, SwapQuote } from '../typings';
import { TokenAmount } from '../utils';

import { Timer } from './Timer';

type NavigationProps = ModalScreenProps<SendRoutesParams>;

function convertToSwapInfo(options: {
  swapQuote: SwapQuote;
  quoteParams: QuoteParams;
  inputAmount: TokenAmount;
  outputAmount: TokenAmount;
  account: BaseAccount;
}) {
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

const Preview = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const swapSlippagePercent = useAppSelector(
    (s) => s.settings.swapSlippagePercent,
  );
  const receivingAddress = useAppSelector((s) => s.swap.receivingAddress);
  const addTransaction = useTransactionAdder();
  const { account, network } = useActiveWalletAccount();
  const {
    inputToken,
    outputToken,
    independentField,
    inputTokenNetwork,
    outputTokenNetwork,
  } = useSwapState();
  const { inputAmount, outputAmount, swapQuote } = useSwap();
  const params = useSwapQuoteRequestParams();

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
    const res = await swapClient.encodeTx({
      ...params,
      activeAccount: account,
      activeNetwok: network,
      receivingAddress,
    });
    if (res?.data) {
      const encodedTx: IEncodedTxEvm = {
        ...res?.data,
        from: account.address,
      };
      const { orderId } = res;
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
            onSuccess: (tx) => {
              if (
                inputAmount &&
                inputTokenNetwork &&
                outputAmount &&
                outputTokenNetwork
              ) {
                const tokenA = `${inputAmount?.value.toFixed(
                  2,
                )} ${inputAmount?.token.symbol.toUpperCase()} (${
                  inputTokenNetwork?.shortName
                })`;
                const tokenB = `${outputAmount?.value.toFixed(
                  2,
                )} ${outputAmount?.token.symbol.toUpperCase()} (${
                  outputTokenNetwork?.shortName
                })`;
                addTransaction({
                  hash: tx.txid,
                  orderId,
                  summary: `${tokenA} → ${tokenB}`,
                });
              }
            },
          },
        },
      });
    } else if (res?.resMsg) {
      toast.show({ title: res?.resMsg });
    } else {
      toast.show({ title: intl.formatMessage({ id: 'msg__unknown_error' }) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, account, network, addTransaction]);
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
            <Typography.DisplayMedium>
              {independentField === 'INPUT'
                ? inputAmount?.value.toFixed()
                : inputAmount?.value.toFixed(4)}
            </Typography.DisplayMedium>
            <Box flexDirection="row" alignItems="center">
              <Box position="relative">
                <Token size="6" src={inputToken?.logoURI} />
                {inputTokenNetwork ? (
                  <Box
                    position="absolute"
                    right="-4"
                    top="-4"
                    w="18px"
                    h="18px"
                    bg="surface-subdued"
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    borderRadius="full"
                  >
                    <Token size="4" src={inputTokenNetwork?.logoURI} />
                  </Box>
                ) : null}
              </Box>
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
            <Typography.DisplayMedium>
              {independentField === 'OUTPUT'
                ? outputAmount?.value.toFixed()
                : outputAmount?.value.toFixed(4)}
            </Typography.DisplayMedium>
            <Box flexDirection="row" alignItems="center">
              <Box position="relative">
                <Token size="6" src={outputToken?.logoURI} />
                {outputTokenNetwork ? (
                  <Box
                    position="absolute"
                    right="-4"
                    top="-4"
                    w="18px"
                    h="18px"
                    bg="surface-subdued"
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    borderRadius="full"
                  >
                    <Token size="4" src={outputTokenNetwork?.logoURI} />
                  </Box>
                ) : null}
              </Box>
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
              <ExchangeRate
                tokenA={inputToken}
                tokenB={outputToken}
                quote={swapQuote}
                independentField={independentField}
              />
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
            <Typography.Body2>0.875%</Typography.Body2>
          </Box>
        </VStack>
      </Box>
    </Modal>
  );
};

export default Preview;
