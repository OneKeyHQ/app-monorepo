import { useCallback, useMemo, useState } from 'react';
import type { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  Hidden,
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
import { useActiveWalletAccount, useAppSelector } from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { addTransaction } from '../../../store/reducers/staking';
import { formatAmount } from '../../../utils/priceUtils';
import { SendModalRoutes } from '../../Send/types';
import { useSwapSubmit } from '../../Swap/hooks/useSwapSubmit';
import { StakingKeyboard } from '../components/StakingKeyboard';
import { useLidoOverview } from '../hooks';
import { StakingRoutes } from '../typing';
import { buildWithdrawStEthTransaction } from '../utils';

import type { StakingRoutesParams } from '../typing';

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

export default function UnstakeAmount() {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { account, networkId } = useActiveWalletAccount();
  const mainPrice = useSimpleTokenPriceValue({ networkId });
  const lidoOverview = useLidoOverview(networkId, account?.id);
  const balance = lidoOverview?.balance ?? '0';
  const tokenSymbol = 'stETH';
  const stEthRate = useAppSelector((s) => s.staking.stEthRate);
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
    if (account && networkId) {
      const { params, quote } = await buildWithdrawStEthTransaction({
        networkId,
        account,
        typedValue: amount,
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
                type: 'lidoUnstake',
                nonce: decodedTx?.nonce,
                addedTime: Date.now(),
              },
            }),
          );
          navigation.replace(RootRoutes.Modal, {
            screen: ModalRoutes.Staking,
            params: {
              screen: StakingRoutes.StakedETHOnLido,
              params: {},
            },
          });
          ToastManager.show({
            title: intl.formatMessage({ id: 'msg__success' }),
          });
        },
      });
    }
  }, [networkId, account, amount, swapSubmit, navigation, intl]);

  const onUnstakeByLido = useCallback(async () => {
    if (!account) {
      return;
    }
    const token = await backgroundApiProxy.serviceStaking.getStEthToken({
      networkId,
    });
    const value = new BigNumber(amount).shiftedBy(token.decimals).toFixed(0);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
    const accountId = account.id;

    const message = await backgroundApiProxy.serviceStaking.buildStEthPermit({
      accountId,
      networkId,
      value,
      deadline,
    });

    if (!message) {
      ToastManager.show(
        { title: intl.formatMessage({ id: 'form__failed' }) },
        { type: 'error' },
      );
      return;
    }

    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendModalRoutes.SignMessageConfirm,
        params: {
          accountId: account.id,
          networkId,
          hideToast: true,
          unsignedMessage: {
            type: 4,
            message,
          },
          closeImmediately: true,
          onSuccess: async (signature: string) => {
            const r = `0x${signature.substring(2).substring(0, 64)}`;
            const s = `0x${signature.substring(2).substring(64, 128)}`;
            const v = parseInt(signature.substring(2).substring(128, 130), 16);

            const permitTx =
              await backgroundApiProxy.serviceStaking.buildRequestWithdrawalsWithPermit(
                {
                  networkId,
                  amounts: [value],
                  owner: account.address,
                  permit: { v, s, r, value, deadline },
                },
              );

            const encodedTx: IEncodedTxEvm = {
              ...permitTx,
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
                            type: 'lidoUnstake',
                            nonce: data?.decodedTx?.nonce,
                            addedTime: Date.now(),
                          },
                        }),
                      );
                      navigation.replace(RootRoutes.Modal, {
                        screen: ModalRoutes.Staking,
                        params: {
                          screen: StakingRoutes.StakedETHOnLido,
                          params: {},
                        },
                      });
                    },
                  },
                },
              });
            }, 10);
          },
        },
      },
    });
  }, [networkId, account, amount, navigation, intl]);

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
        screen: StakingRoutes.LidoEthUnstakeRoutes,
        params: {
          source,
          amount,
          onSelector: (value) => {
            setSource(value as UnstakeRouteOptionsValue);
            navigation.goBack();
          },
        },
      },
    });
  }, [source, navigation, amount]);

  const rate = useMemo(() => {
    if (source === 'lido') {
      return;
    }
    return stEthRate?.[networkId];
  }, [source, stEthRate, networkId]);

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
                        { '0': '~ 1 - 3' },
                      )
                      .toLowerCase()
                  : intl.formatMessage(
                      { id: 'content__str_minutes_plural' },
                      { '0': '~ 1-5' },
                    )}
              </Typography.Body2Strong>
            </Box>
            <Hidden>
              {rate ? (
                <Box
                  flexDirection="row"
                  justifyContent="space-between"
                  alignItems="center"
                  h="10"
                >
                  <Typography.Body2 color="text-subdued">
                    {intl.formatMessage({ id: 'form__est_receipt' })}
                  </Typography.Body2>
                  <Typography.Body2Strong>
                    {new BigNumber(rate).multipliedBy(amount).toFixed()}ETH
                  </Typography.Body2Strong>
                </Box>
              ) : null}
            </Hidden>
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
          </VStack>
        </Box>
        <StakingKeyboard text={amount} onTextChange={setAmount} />
      </Box>
    </Modal>
  );
}
