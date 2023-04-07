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
  NumberInput,
  Text,
  ToastManager,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
// import { AutoSizeText } from '../../../components/AutoSizeText';
import { FormatCurrency } from '../../../components/Format';
import { useActiveWalletAccount, useNetworkSimple } from '../../../hooks';
import { useAppSelector } from '../../../hooks/redux';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import { useSingleToken } from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { formatAmount } from '../../../utils/priceUtils';
import { SendModalRoutes } from '../../Send/types';
import {
  useIntlMinutes,
  useKeleMinerOverview,
  useKeleUnstakeOverview,
} from '../hooks';
import { StakingRoutes } from '../typing';

import type { StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<StakingRoutesParams, StakingRoutes.StakingAmount>;

export default function UnstakeAmount() {
  const intl = useIntl();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { networkId, tokenIdOnNetwork } = route.params;
  const { account, accountId } = useActiveWalletAccount();
  const [isLoading, setIsLoading] = useState(false);
  const keleDashboardGlobal = useAppSelector(
    (s) => s.staking.keleDashboardGlobal,
  );
  const minerOverview = useKeleMinerOverview(networkId, accountId);
  const keleUnstakeOverview = useKeleUnstakeOverview(networkId, accountId);
  const mainPrice = useSimpleTokenPriceValue({ networkId });

  const balance = minerOverview?.amount.retail_staked ?? '0';
  const retailMinAmount = keleDashboardGlobal?.retail_min_amount ?? '0';
  const sec = keleUnstakeOverview?.estimate_use_sec ?? 60;
  const intlMinutes = useIntlMinutes(Math.floor(sec / 60));

  const [amount, setAmount] = useState('');

  const network = useNetworkSimple(networkId);

  const { token: tokenInfo } = useSingleToken(
    networkId,
    tokenIdOnNetwork ?? '',
  );

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
    const minAmountBN = new BigNumber(retailMinAmount);
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
  }, [retailMinAmount, amount, intl, tokenInfo]);

  const userInput = useCallback(
    (percent: number) => {
      const bn = new BigNumber(balance);
      if (bn.lte(0)) {
        return;
      }
      const value = bn.multipliedBy(percent).dividedBy(100);
      setAmount(formatAmount(value, 8));
    },
    [balance],
  );

  return (
    <Modal
      header={intl.formatMessage(
        { id: 'title__unstake_str' },
        { '0': tokenInfo?.symbol.toUpperCase() },
      )}
      headerDescription="Kelepool"
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      primaryActionProps={{
        isDisabled: !!errorMsg || !!minAmountErrMsg,
        isLoading,
      }}
      onPrimaryActionPress={() => {
        if (!account || !network || !tokenInfo) {
          return;
        }
        const amountToSend = amount;

        const apiParams = {
          unstake_amt: amountToSend,
          address: account.address,
          type: 'retail',
        };

        const signTime = Math.floor(Date.now() / 1000);

        const signUnstakeParams = {
          sign_time: signTime,
          token: 'eth',
          addr: account.address,
          url: '/eth2/v2/miner/unstake',
          method: 'post',
          api_param: apiParams,
        };

        try {
          setIsLoading(true);
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Send,
            params: {
              screen: SendModalRoutes.SignMessageConfirm,
              params: {
                accountId: account.id,
                networkId: tokenInfo.networkId,
                unsignedMessage: {
                  type: 1,
                  message: JSON.stringify(signUnstakeParams),
                },
                onSuccess: async (signHash: string) => {
                  const res = await backgroundApiProxy.serviceStaking.unstake({
                    ...apiParams,
                    networkId: tokenInfo.networkId,
                    pirvSignRaw: JSON.stringify(signUnstakeParams),
                    signHash,
                  });
                  // eslint-disable-next-line
                  if (res.code !== 0 && res.message) {
                    ToastManager.show(
                      // eslint-disable-next-line
                      { title: res.message as string },
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
                    ToastManager.show({
                      title: intl.formatMessage({ id: 'msg__success' }),
                    });
                    backgroundApiProxy.serviceStaking.fetchMinerOverview({
                      networkId,
                      accountId,
                    });
                  }
                },
              },
            },
          });
        } catch (e: any) {
          console.error(e);
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
            {balance ?? ''} {tokenInfo?.symbol.toUpperCase()}
          </Typography.Body2Strong>
        </Box>
        <Box flexDirection="row" mt="16" justifyContent="space-between">
          <Typography.Body2 color="text-subdued">
            {intl.formatMessage({ id: 'form__est_arrival_time' })}
          </Typography.Body2>
          <Typography.Body2>{intlMinutes}</Typography.Body2>
        </Box>
      </Box>
    </Modal>
  );
}
