/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useRef, useState } from 'react';
import type { ComponentProps, FC } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Image,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../../hooks';
import { useAppSelector } from '../../../../hooks/redux';
import { addTransaction } from '../../../../store/reducers/swapTransactions';
import {
  useCheckInputBalance,
  useInputLimitsError,
  useSwapError,
  useSwapQuoteRequestParams,
} from '../../hooks/useSwap';
import { useSwapSend } from '../../hooks/useSwapSend';
import { useSwapSubmit } from '../../hooks/useSwapSubmit';
import { dangerRefs } from '../../refs';
import { SwapError } from '../../typings';
import { calculateDecodedTxNetworkFee } from '../../utils';

import { WalletACLButton } from './common';
import { SwapProgressButton } from './progress';

type TokenNetworkDisplayProps = {
  token: Token;
};

const TokenNetworkDisplay: FC<TokenNetworkDisplayProps> = ({ token }) => {
  const { network } = useNetwork({ networkId: token.networkId });
  return <Image size="4" src={network?.logoURI} />;
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
              <TokenNetworkDisplay token={tokenA} />
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
              <TokenNetworkDisplay token={tokenB} />
            </Box>
          </Box>
          <Typography.Button1 color="text-on-primary">
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
  const ref = useRef(false);
  const progressStatus = useAppSelector((s) => s.swap.progressStatus);
  const quote = useAppSelector((s) => s.swap.quote);
  const params = useSwapQuoteRequestParams();

  const swapSubmit = useSwapSubmit();

  const onSubmit = useCallback(async () => {
    const recipient = await backgroundApiProxy.serviceSwap.getRecipient();
    await swapSubmit({
      quote,
      params,
      recipient,
      openProgressStatus: () => {
        backgroundApiProxy.serviceSwap.openProgressStatus();
      },
      closeProgressStatus: () => {
        backgroundApiProxy.serviceSwap.closeProgressStatus();
      },
      setProgressStatus(status) {
        backgroundApiProxy.serviceSwap.setProgressStatus(status);
      },
    });
  }, [params, quote, swapSubmit]);

  const onPress = useCallback(async () => {
    if (ref.current) {
      return;
    }
    try {
      ref.current = true;
      dangerRefs.submited = true;
      backgroundApiProxy.serviceSwap.openProgressStatus();
      await onSubmit();
    } finally {
      ref.current = false;
      dangerRefs.submited = false;
      backgroundApiProxy.serviceSwap.closeProgressStatus();
    }
  }, [onSubmit]);

  if (progressStatus) {
    return <SwapProgressButton />;
  }

  return (
    <LinearGradientExchangeButton
      key="submit"
      size="xl"
      type="primary"
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
  return <ExchangeButton />;
};

const WETH9Button = () => {
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

const WETH9StateButton = () => {
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
  return <WETH9Button />;
};

export const SwapButton = () => {
  const wrapperTxInfo = useAppSelector((s) => s.swap.quote?.wrapperTxInfo);
  return wrapperTxInfo ? <WETH9StateButton /> : <ExchangeStateButton />;
};

export const SwapContentButton = () => {
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

export const SwapMainButton = () => (
  <WalletACLButton>
    <SwapContentButton />
  </WalletACLButton>
);
