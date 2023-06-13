import { useCallback, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
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
} from '@onekeyhq/components';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AutoSizeText } from '../../../components/AutoSizeText';
import { FormatCurrency } from '../../../components/Format';
import { useActiveWalletAccount } from '../../../hooks';
import { useAppSelector } from '../../../hooks/redux';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import { useSingleToken } from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
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

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

export default function UnstakeAmount() {
  const intl = useIntl();
  const { height } = useWindowDimensions();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const { networkId, tokenIdOnNetwork } = route.params;
  const { account, accountId } = useActiveWalletAccount();
  const keleDashboardGlobal = useAppSelector(
    (s) => s.staking.keleDashboardGlobal,
  );
  const minerOverview = useKeleMinerOverview(networkId, accountId);
  const keleUnstakeOverview = useKeleUnstakeOverview(networkId, accountId);
  const mainPrice = useSimpleTokenPriceValue({ networkId });
  const shortScreen = height < 768;
  const balance = minerOverview?.amount.retail_staked ?? '0';
  const retailMinAmount = keleDashboardGlobal?.retail_min_amount ?? '0';
  const sec = keleUnstakeOverview?.estimate_use_sec ?? 60;
  const intlMinutes = useIntlMinutes(Math.floor(sec / 60));

  const [amount, setAmount] = useState('');

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

  const validAmountRegex = useMemo(() => {
    const pattern = `^(0|([1-9][0-9]*))?\\.?([0-9]{1,18})?$`;
    return new RegExp(pattern);
  }, []);

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
      header={intl.formatMessage(
        { id: 'title__unstake_str' },
        { '0': tokenInfo?.symbol.toUpperCase() },
      )}
      headerDescription="Kelepool"
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
                if (res.code !== 0 && res.message) {
                  ToastManager.show({ title: res.message }, { type: 'error' });
                } else {
                  setAmount('');
                  backgroundApiProxy.serviceStaking.fetchMinerOverview({
                    networkId,
                    accountId,
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
      <Box flex="1">
        <Box flex="1" flexDirection="column" justifyContent="space-between">
          <Center flex="1" flexDirection="column" justifyContent="space-around">
            <Center flex="1" maxH="140px">
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
                  {balance ?? ''} {tokenInfo?.symbol.toUpperCase()}
                </Typography.Body2Strong>
              </Box>
            </Center>
          </Center>
          <Box flexDirection="row" justifyContent="space-between">
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__est_arrival_time' })}
            </Typography.Body2>
            <Typography.Body2>{intlMinutes}</Typography.Body2>
          </Box>
        </Box>
        {platformEnv.isNative && (
          <Box mt="4">
            <Keyboard
              itemHeight={shortScreen ? '44px' : undefined}
              pattern={validAmountRegex}
              text={amount}
              onTextChange={(text) => {
                setAmount(text);
              }}
            />
          </Box>
        )}
      </Box>
    </Modal>
  );
}
