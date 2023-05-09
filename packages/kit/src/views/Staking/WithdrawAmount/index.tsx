import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Button,
  Center,
  HStack,
  Keyboard,
  Modal,
  Text,
  ToastManager,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AutoSizeText } from '../../../components/AutoSizeText';
import { FormatCurrency } from '../../../components/Format';
import { useActiveWalletAccount, useNavigation } from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import { useSingleToken } from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { formatAmount } from '../../../utils/priceUtils';
import { SendModalRoutes } from '../../Send/types';
import { useKeleWithdrawOverview } from '../hooks';
import { StakingRoutes } from '../typing';

import type { StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<StakingRoutesParams, StakingRoutes.WithdrawAmount>;

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

export default function WithdrawAmount() {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const { height } = useWindowDimensions();
  const { networkId, tokenIdOnNetwork } = route.params;
  const { accountId, account } = useActiveWalletAccount();
  const withdrawalOverview = useKeleWithdrawOverview(networkId, accountId);

  const mainPrice = useSimpleTokenPriceValue({ networkId });

  const balance = withdrawalOverview?.balance ?? '0';
  const minInputAmount = withdrawalOverview?.user_fee ?? '0';
  const shortScreen = height < 768;
  const [amount, setAmount] = useState('');

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
    if (
      amountBN.isNaN() ||
      balanceBN.isNaN() ||
      balanceBN.isLessThan(amountBN)
    ) {
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
      if (amountBN.isNaN() || (amountBN.gt(0) && amountBN.lte(minAmountBN))) {
        return `${intl.formatMessage(
          {
            id: 'form__field_large_than',
          },
          { '0': `${minAmountBN.toFixed()} ${symbol}` },
        )}`;
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

  const validAmountRegex = useMemo(() => {
    const pattern = `^(0|([1-9][0-9]*))?\\.?([0-9]{1,18})?$`;
    return new RegExp(pattern);
  }, []);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__withdraw' })}
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      primaryActionProps={{
        isDisabled:
          !!errorMsg || !!minAmountErrMsg || new BigNumber(amount).lte(0),
      }}
      onPrimaryActionPress={() => {
        if (!account || !tokenInfo) {
          return;
        }
        const message = { token: 'eth', amount, address: account.address };
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendModalRoutes.SignMessageConfirm,
            params: {
              accountId,
              networkId: tokenInfo.networkId,
              unsignedMessage: {
                type: 1,
                message: JSON.stringify(message),
              },
              onSuccess: async () => {
                const res = await backgroundApiProxy.serviceStaking.withdraw({
                  accountId: account.id,
                  networkId,
                  amount,
                });
                if (res.code !== 0 && res.message) {
                  ToastManager.show({ title: res.message }, { type: 'error' });
                } else {
                  setAmount('');
                  backgroundApiProxy.serviceStaking.fetchPendingWithdrawAmount({
                    accountId,
                    networkId,
                  });
                  navigation.replace(RootRoutes.Modal, {
                    screen: ModalRoutes.Staking,
                    params: {
                      screen: StakingRoutes.Feedback,
                      params: {
                        networkId,
                      },
                    },
                  });
                }
              },
            },
          },
        });
      }}
    >
      <Box flex="1" flexDirection="column" justifyContent="space-between">
        <Box flex="1" flexDirection="column" justifyContent="space-between">
          <Center flex={1} flexDirection="column" justifyContent="space-around">
            <Center flex={1} maxH="140px">
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
              <Box
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
                h="8"
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
            </Center>
          </Center>
          <VStack space="1">
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
        {platformEnv.isNative && (
          <Box mt="4">
            <Keyboard
              itemHeight={shortScreen ? '44px' : undefined}
              pattern={validAmountRegex}
              text={amount}
              onTextChange={setAmount}
            />
          </Box>
        )}
      </Box>
    </Modal>
  );
}
