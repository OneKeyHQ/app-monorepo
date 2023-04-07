import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  Modal,
  NumberInput,
  Text,
  ToastManager,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
// import { AutoSizeText } from '../../../components/AutoSizeText';
import { FormatCurrency } from '../../../components/Format';
import {
  useActiveWalletAccount,
  useNavigation,
  useNetworkSimple,
} from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import { useSingleToken } from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { formatAmount } from '../../../utils/priceUtils';
import { useKeleWithdrawOverview } from '../hooks';
import { StakingRoutes } from '../typing';

import type { StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<StakingRoutesParams, StakingRoutes.StakingAmount>;

export default function WithdrawAmount() {
  const intl = useIntl();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { networkId, tokenIdOnNetwork } = route.params;
  const { account, accountId } = useActiveWalletAccount();
  const [isLoading, setIsLoading] = useState(false);
  const withdrawalOverview = useKeleWithdrawOverview(networkId, accountId);

  const mainPrice = useSimpleTokenPriceValue({ networkId });

  const balance = withdrawalOverview?.balance ?? '0';
  const minInputAmount = withdrawalOverview?.user_fee ?? '0';

  const [amount, setAmount] = useState('');

  const network = useNetworkSimple(networkId);

  const { token: tokenInfo } = useSingleToken(
    networkId,
    tokenIdOnNetwork ?? '',
  );

  const actualArrival = useMemo(() => {
    const a = new BigNumber(amount);
    const b = new BigNumber(minInputAmount);
    const value = a.minus(b);
    if (value.gt(0)) {
      return formatAmount(value, 8);
    }
  }, [amount, minInputAmount]);

  const errorMsg = useMemo(() => {
    if (!tokenInfo || !amount) {
      return 'error';
    }
    const amountBN = new BigNumber(amount);
    const balanceBN = new BigNumber(balance);
    const { symbol } = tokenInfo;
    if (amountBN.isNaN() || balanceBN.isNaN()) {
      return intl.formatMessage({ id: 'form__amount_invalid' }, { 0: symbol });
    }
    if (balanceBN.isLessThan(amountBN)) {
      return intl.formatMessage({ id: 'form__amount_invalid' }, { 0: symbol });
    }
    return undefined;
  }, [amount, intl, balance, tokenInfo]);

  const minAmountErrMsg = useMemo(() => {
    const minAmountBN = new BigNumber(minInputAmount);
    const minAmountRequired = !minAmountBN.isNaN() && minAmountBN.gt('0');
    const input = amount.trim();
    const symbol = tokenInfo?.symbol ?? '';
    if (minAmountRequired && input) {
      const amountBN = new BigNumber(input);
      if (amountBN.isNaN() || (amountBN.gt(0) && amountBN.lt(minAmountBN))) {
        return `${intl.formatMessage({
          id: 'form__min_amount',
        })} ${minAmountBN.toFixed()} ${symbol}`;
      }
    }
  }, [minInputAmount, amount, intl, tokenInfo]);

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

  return (
    <Modal
      header="Withdrawal"
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      primaryActionProps={{
        isDisabled: !!errorMsg || !!minAmountErrMsg,
        isLoading,
      }}
      onPrimaryActionPress={async () => {
        if (!account || !network || !tokenInfo) {
          return;
        }
        const amountToSend = amount;

        try {
          setIsLoading(true);
          const res = await backgroundApiProxy.serviceStaking.withdraw({
            accountId: account.id,
            networkId: tokenInfo.networkId,
            amount: amountToSend,
          });
          // eslint-disable-next-line
          if (res.code !== 0 && res.message) {
            ToastManager.show(
              // eslint-disable-next-line
              { title: res.message },
              { type: 'error' },
            );
          } else {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Staking,
              params: {
                screen: StakingRoutes.StakedETHOnKele,
                params: {
                  networkId,
                },
              },
            });
            await backgroundApiProxy.serviceStaking.fetchPendingWithdrawAmount({
              accountId: account.id,
              networkId: tokenInfo.networkId,
            });
            ToastManager.show({
              title: intl.formatMessage({ id: 'msg__success' }),
            });
          }
        } catch (e: any) {
          const { key: errorKey = '' } = e;
          if (errorKey === 'form__amount_invalid') {
            ToastManager.show({
              title: intl.formatMessage(
                { id: 'form__amount_invalid' },
                { 0: tokenInfo?.symbol ?? '' },
              ),
            });
          }
        } finally {
          setIsLoading(false);
        }
      }}
    >
      <Box flexDirection="column">
        <Box py={4} my={6} justifyContent="center">
          <Text
            textAlign="center"
            typography="DisplayLarge"
            color="text-subdued"
          >
            {tokenInfo?.symbol.toUpperCase() ?? ''}
          </Text>
          <Center flex={1} py="8">
            <NumberInput
              autoFocus
              textAlign="center"
              borderWidth="0"
              fontSize="64px"
              h="80px"
              placeholder="0"
              placeholderTextColor="text-disabled"
              focusOutlineColor="transparent"
              fontWeight="bold"
              bgColor="transparent"
              onChangeText={setAmount}
              value={amount}
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
        </Box>
        <Center>
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
        </Center>
        <Box
          mt="4"
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
            {formatAmount(balance, 8)} {tokenInfo?.symbol.toUpperCase()}
          </Typography.Body2Strong>
        </Box>
        <VStack space="1" mt="16">
          <Box flexDirection="row" justifyContent="space-between">
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'content__gas_fee' })}
            </Typography.Body2>
            <Typography.Body2>
              {minInputAmount} {tokenInfo?.symbol.toUpperCase()}
            </Typography.Body2>
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__receive_address' })}
            </Typography.Body2>
            <Typography.Body2>
              {shortenAddress(account?.address ?? '')}
            </Typography.Body2>
          </Box>
          {actualArrival ? (
            <Box flexDirection="row" justifyContent="space-between">
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage({ id: 'form__actual_arrival' })}
              </Typography.Body2>
              <Typography.Body2>{actualArrival}</Typography.Body2>
            </Box>
          ) : null}
        </VStack>
      </Box>
    </Modal>
  );
}
