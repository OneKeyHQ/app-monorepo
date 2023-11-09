import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  CustomSkeleton,
  HStack,
  Icon,
  Image,
  Modal,
  Pressable,
  Text,
  ToastManager,
  Typography,
  VStack,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AutoSizeText } from '../../../components/AutoSizeText';
import { FormatCurrency } from '../../../components/Format';
import { useDebounce } from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { addTransaction } from '../../../store/reducers/staking';
import { formatAmount } from '../../../utils/priceUtils';
import { SendModalRoutes } from '../../Send/types';
import { useSwapSubmit } from '../../Swap/hooks/useSwapSubmit';
import { div, formatAmountExact, multiply } from '../../Swap/utils';
import { getMaticContractAdderess } from '../address';
import { StakingKeyboard } from '../components/StakingKeyboard';
import { useLidoMaticOverview } from '../hooks';
import { getStMaticToMaticQuote } from '../quote';
import { StakingRoutes } from '../typing';

import type { StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

type UnstakeRouteOptionsValue = 'onekey' | 'lido';

type UnstakeRouteOptionsProps = {
  value: UnstakeRouteOptionsValue;
};

const UnstakeRouteOptions: FC<UnstakeRouteOptionsProps> = ({ value }) => {
  if (value === 'lido') {
    return (
      <Box flexDirection="row" alignItems="center">
        <Image
          key="lido"
          w="5"
          h="5"
          source={require('@onekeyhq/kit/assets/staking/lido_pool.png')}
        />
        <Typography.Body2Strong ml="2">Lido</Typography.Body2Strong>
        <Icon name="ChevronRightMini" />
      </Box>
    );
  }
  return (
    <Box flexDirection="row" alignItems="center">
      <Image
        key="onekey"
        w="5"
        h="5"
        source={require('@onekeyhq/kit/assets/logo.png')}
      />
      <Typography.Body2Strong ml="2">OneKey Swap</Typography.Body2Strong>
      <Icon name="ChevronRightMini" />
    </Box>
  );
};

type YouWillReceiveTokenUsingSwapProps = {
  value: string;
  networkId: string;
  accountId: string;
};

const YouWillReceiveTokenUsingSwap: FC<YouWillReceiveTokenUsingSwapProps> = (
  props,
) => {
  const { value, networkId, accountId } = props;
  const [loading, setLoading] = useState(false);
  const [amountReceived, setAmountReceived] = useState('');
  const ref = useRef<{ amount: string; num: number }>({ amount: '', num: 0 });
  const amount = useDebounce(value, 500);
  useEffect(() => {
    async function main() {
      if (!amount) {
        return;
      }
      ref.current.amount = amount;
      ref.current.num += 1;
      try {
        setLoading(true);
        const amountToQuote = amount;
        const res = await getStMaticToMaticQuote({
          value: amountToQuote,
          networkId,
          accountId,
        });
        if (res && res.quote && amountToQuote === ref.current.amount) {
          const estimatedAmount = multiply(
            div(res.quote.buyAmount, res.quote.sellAmount),
            amountToQuote,
          );
          console.log('estimatedAmount', estimatedAmount);
          setAmountReceived(estimatedAmount);
        }
      } finally {
        if (ref.current.num > 0) {
          ref.current.num -= 1;
        }
        if (ref.current.num === 0) {
          setLoading(false);
        }
      }
    }
    main();
  }, [amount, networkId, accountId]);
  if (loading) {
    return (
      <Box h="4" width="24" borderRadius="2px" overflow="hidden">
        <CustomSkeleton />
      </Box>
    );
  }
  return (
    <Box>
      <Typography.Body2>
        {formatAmountExact(amountReceived || '0', 4)} Matic
      </Typography.Body2>
    </Box>
  );
};

type RouteProps = RouteProp<StakingRoutesParams, StakingRoutes.LidoEthUnstake>;

export default function LidoMaticUnstake() {
  const intl = useIntl();
  const {
    params: { networkId, accountId },
  } = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const mainPrice = useSimpleTokenPriceValue({
    networkId,
    contractAdress: getMaticContractAdderess(networkId),
  });
  const lidoOverview = useLidoMaticOverview(networkId, accountId);
  const balance = lidoOverview?.balance ?? '0';
  const tokenSymbol = 'stMatic';
  const [source, setSource] = useState<UnstakeRouteOptionsValue>('lido');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const swapSubmit = useSwapSubmit();

  const errorMsg = useMemo(() => {
    if (!amount) {
      return 'error';
    }
    const amountBN = new BigNumber(amount);
    const balanceBN = new BigNumber(balance);
    if (
      amountBN.isNaN() ||
      balanceBN.isNaN() ||
      balanceBN.isLessThan(amountBN)
    ) {
      return intl.formatMessage(
        { id: 'form__amount_invalid' },
        { 0: tokenSymbol },
      );
    }
    return undefined;
  }, [amount, intl, balance, tokenSymbol]);

  const minAmountErrMsg = useMemo(() => {
    const minAmountBN =
      source === 'lido' ? new BigNumber(0.0000001) : new BigNumber(0.000000001); // lido 100gwei limit
    const input = amount.trim();
    const amountBN = new BigNumber(input);
    if (
      minAmountBN.gt(0) &&
      input &&
      (amountBN.isNaN() || (amountBN.gt(0) && amountBN.lt(minAmountBN)))
    ) {
      return `${intl.formatMessage({
        id: 'form__min_amount',
      })} ${minAmountBN.toFixed()} ${tokenSymbol}`;
    }
  }, [amount, intl, tokenSymbol, source]);

  const userInput = useCallback(
    (percent: number) => {
      const bn = new BigNumber(balance);
      if (bn.lte(0)) {
        return;
      }
      const text =
        percent >= 100
          ? balance
          : formatAmount(bn.multipliedBy(percent).dividedBy(100), 8);
      setAmount(text);
    },
    [balance],
  );

  const onUnstakeBySwap = useCallback(async () => {
    const account = await backgroundApiProxy.engine.getAccount(
      accountId,
      networkId,
    );
    if (account && networkId) {
      const { params, quote } = await getStMaticToMaticQuote({
        networkId,
        accountId,
        value: amount,
      });
      await swapSubmit({
        params,
        quote,
        recipient: account,
        // eslint-disable-next-line @typescript-eslint/require-await
        onSuccess: async ({ result, decodedTx }) => {
          backgroundApiProxy.dispatch(
            addTransaction({
              accountId: account.id,
              networkId,
              transaction: {
                hash: result.txid,
                accountId: account.id,
                networkId,
                type: 'lidoUnstakeMatic',
                nonce: decodedTx?.nonce,
                addedTime: Date.now(),
              },
            }),
          );
          navigation.replace(RootRoutes.Modal, {
            screen: ModalRoutes.Staking,
            params: {
              screen: StakingRoutes.StakedMaticOnLido,
              params: {
                accountId,
                networkId,
              },
            },
          });
          ToastManager.show({
            title: intl.formatMessage({ id: 'msg__success' }),
          });
        },
      });
    }
  }, [networkId, amount, swapSubmit, navigation, intl, accountId]);

  const onUnstakeByLido = useCallback(async () => {
    const token = await backgroundApiProxy.serviceStaking.getStEthToken({
      networkId,
    });

    const value = new BigNumber(amount).shiftedBy(token.decimals).toFixed(0);

    const account = await backgroundApiProxy.engine.getAccount(
      accountId,
      networkId,
    );

    const unstakingTx =
      await backgroundApiProxy.serviceStaking.buildTransactionUnstakeMatic({
        accountId,
        networkId,
        amount: value,
      });

    const encodedTx: IEncodedTxEvm = {
      ...unstakingTx,
      from: account.address,
    };

    setTimeout(() => {
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
              ToastManager.show({
                title: intl.formatMessage({ id: 'msg__success' }),
              });
              backgroundApiProxy.dispatch(
                addTransaction({
                  accountId: account.id,
                  networkId,
                  transaction: {
                    hash: tx.txid,
                    accountId: account.id,
                    networkId,
                    type: 'lidoUnstakeMatic',
                    nonce: data?.decodedTx?.nonce,
                    addedTime: Date.now(),
                  },
                }),
              );
              navigation.replace(RootRoutes.Modal, {
                screen: ModalRoutes.Staking,
                params: {
                  screen: StakingRoutes.StakedMaticOnLido,
                  params: {
                    accountId,
                    networkId,
                  },
                },
              });
            },
          },
        },
      });
    }, 10);
  }, [networkId, amount, navigation, intl, accountId]);

  const onPrimaryActionPress = useCallback(async () => {
    try {
      setLoading(true);
      if (source === 'onekey') {
        await onUnstakeBySwap();
      } else {
        await onUnstakeByLido();
      }
    } finally {
      setLoading(false);
    }
  }, [source, onUnstakeBySwap, onUnstakeByLido]);

  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.LidoUnstakeRoutes,
        params: {
          source,
          amount,
          accountId,
          networkId,
          onSelector: (value) => {
            setSource(value as UnstakeRouteOptionsValue);
            navigation.goBack();
          },
        },
      },
    });
  }, [source, navigation, amount, networkId, accountId]);

  return (
    <Modal
      header={intl.formatMessage(
        { id: 'title__unstake_str' },
        { '0': tokenSymbol },
      )}
      headerDescription="Lido"
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      primaryActionProps={{
        isDisabled: !!errorMsg || new BigNumber(amount).lte(0),
        onPress: onPrimaryActionPress,
        isLoading: loading,
      }}
    >
      <Box flex="1">
        <Box flex="1" flexDirection="column" justifyContent="space-between">
          <Center flex="1" flexDirection="column" justifyContent="space-around">
            <Center flex="1" maxH="140px">
              <Text
                textAlign="center"
                typography="DisplayLarge"
                color="text-subdued"
              >
                {tokenSymbol}
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
            <Center>
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
                  {formatAmount(balance ?? '', 6)} {tokenSymbol}
                </Typography.Body2Strong>
              </Box>
            </Center>
          </Center>
          <VStack>
            <Box
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              h="10"
            >
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage({ id: 'form__est_arrival_time' })}
              </Typography.Body2>
              <Typography.Body2Strong>
                {source === 'lido'
                  ? intl
                      .formatMessage(
                        { id: 'form__str_day' },
                        { '0': '~ 3 - 4' },
                      )
                      .toLowerCase()
                  : intl.formatMessage(
                      { id: 'content__str_minutes_plural' },
                      { '0': '~ 1 - 5' },
                    )}
              </Typography.Body2Strong>
            </Box>
            <Box
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              h="10"
            >
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage({ id: 'form__route' })}
              </Typography.Body2>
              <Pressable onPress={onPress}>
                <UnstakeRouteOptions value={source} />
              </Pressable>
            </Box>
            {lidoOverview?.maticToStMaticRate && source === 'lido' ? (
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
                  1 stMatic ={' '}
                  {formatAmount(div(1, lidoOverview.maticToStMaticRate), 4)}{' '}
                  Matic
                </Typography.Body2>
              </Box>
            ) : null}
            {lidoOverview?.maticToStMaticRate && amount && source === 'lido' ? (
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
                    div(amount, lidoOverview.maticToStMaticRate),
                    4,
                  )}{' '}
                  Matic
                </Typography.Body2>
              </Box>
            ) : null}
            {source === 'onekey' ? (
              <Box
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                h="10"
              >
                <Typography.Body2 color="text-subdued">
                  {intl.formatMessage({ id: 'form__you_receive' })}
                </Typography.Body2>
                <YouWillReceiveTokenUsingSwap
                  value={amount}
                  networkId={networkId}
                  accountId={accountId}
                />
              </Box>
            ) : null}
          </VStack>
        </Box>
        <StakingKeyboard text={amount} onTextChange={setAmount} />
      </Box>
    </Modal>
  );
}
