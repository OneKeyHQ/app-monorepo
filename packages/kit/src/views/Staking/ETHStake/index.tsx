import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AutoSizeText } from '../../../components/AutoSizeText';
import { FormatCurrency } from '../../../components/Format';
import { useActiveWalletAccount } from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import {
  useSingleToken,
  useTokenBalanceWithoutFrozen,
} from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { appSelector } from '../../../store';
import { addTransaction } from '../../../store/reducers/staking';
import { formatAmount } from '../../../utils/priceUtils';
import { SendModalRoutes } from '../../Send/types';
import { StakingKeyboard } from '../components/StakingKeyboard';
import { useStakingAprValue } from '../hooks';
import { EthStakingSource, StakingRoutes } from '../typing';

import type { StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<StakingRoutesParams, StakingRoutes.ETHStake>;

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

type StakingProvderOptionsProps = {
  source: EthStakingSource;
};

const StakingProvderOptions: FC<StakingProvderOptionsProps> = ({ source }) => {
  if (source === EthStakingSource.Lido) {
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
        key="kele"
        w="5"
        h="5"
        source={require('@onekeyhq/kit/assets/staking/kele_pool.png')}
      />
      <Typography.Body2Strong ml="2">Kele</Typography.Body2Strong>
      <Icon name="ChevronRightMini" />
    </Box>
  );
};

export default function ETHStaking() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { account, accountId, networkId } = useActiveWalletAccount();
  const mainPrice = useSimpleTokenPriceValue({ networkId });
  const [source, setSource] = useState(route.params.source);

  const aprValue = useStakingAprValue(
    source,
    networkId === OnekeyNetwork.goerli,
  );

  useEffect(() => {
    if (!aprValue) {
      backgroundApiProxy.serviceStaking.fetchEthAprSma();
    }
    // eslint-disable-next-line
  }, [])

  const [amount, setAmount] = useState('');
  const { token: tokenInfo } = useSingleToken(networkId, '');

  const tokenBalance = useTokenBalanceWithoutFrozen({
    networkId,
    accountId,
    token: tokenInfo,
    fallback: '0',
  });

  const errorMsg = useMemo(() => {
    if (!tokenInfo || !amount) {
      return 'error';
    }
    const amountBN = new BigNumber(amount);
    const balanceBN = new BigNumber(tokenBalance);
    const { symbol } = tokenInfo;
    if (
      amountBN.isNaN() ||
      balanceBN.isNaN() ||
      balanceBN.isLessThan(amountBN)
    ) {
      return intl.formatMessage({ id: 'form__amount_invalid' }, { 0: symbol });
    }
    return undefined;
  }, [amount, intl, tokenBalance, tokenInfo]);

  const minAmountErrMsg = useMemo(() => {
    const minAmountBN =
      source === EthStakingSource.Kele
        ? new BigNumber('0.01')
        : new BigNumber('0.0000001');
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
  }, [amount, intl, tokenInfo, source]);

  const userInput = useCallback(
    (percent: number) => {
      const bn = new BigNumber(tokenBalance);
      if (bn.lte(0)) {
        return;
      }
      const text =
        percent >= 100
          ? tokenBalance
          : formatAmount(bn.multipliedBy(percent).dividedBy(100), 8);
      setAmount(text);
    },
    [tokenBalance],
  );

  const onPress = useCallback(() => {
    navigation.push(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.ETHPoolSelector,
        params: {
          isTestnet: networkId === OnekeyNetwork.goerli,
          onSelector: (s) => {
            setSource(s);
            const parent = navigation.getParent();
            if (parent) {
              parent.goBack();
            } else {
              navigation.goBack();
            }
          },
        },
      },
    });
  }, [navigation, networkId]);

  const onPrimaryActionPress = useCallback(
    async ({ onClose }: { onClose?: () => void }) => {
      if (!account || !tokenInfo) {
        return;
      }

      const value = new BigNumber(amount)
        .shiftedBy(tokenInfo.decimals)
        .toFixed(0);

      let encodedTx: IEncodedTxEvm | undefined;
      if (source === EthStakingSource.Kele) {
        const data =
          await backgroundApiProxy.serviceStaking.buildTxForStakingETHtoKele({
            value,
            networkId,
          });
        encodedTx = {
          ...data,
          from: account.address,
        };
      } else {
        const data =
          await backgroundApiProxy.serviceStaking.buildTxForStakingETHtoLido({
            value,
            networkId,
          });
        encodedTx = {
          ...data,
          from: account.address,
        };
      }
      onClose?.();
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendModalRoutes.SendConfirm,
          params: {
            networkId,
            accountId,
            payloadInfo: {
              type: 'InternalStake',
              stakeInfo: {
                tokenInfo,
                amount,
                accountAddress: account.address,
              },
            },
            feeInfoEditable: true,
            feeInfoUseFeeInTx: false,
            encodedTx: { ...encodedTx, from: account?.address },
            onSuccess: (tx, data) => {
              if (source === EthStakingSource.Kele) {
                const keleMinerOverviews = appSelector(
                  (s) => s.staking.keleMinerOverviews,
                );
                const minerOverview =
                  keleMinerOverviews?.[accountId]?.[networkId];
                backgroundApiProxy.serviceStaking.setAccountStakingActivity({
                  networkId,
                  accountId: account.id,
                  data: {
                    nonce: data?.decodedTx?.nonce,
                    oldValue: minerOverview?.amount?.total_amount,
                    txid: tx.txid,
                    amount,
                    createdAt: Date.now(),
                    type: 'kele',
                  },
                });
              } else {
                backgroundApiProxy.serviceStaking.addStEthToUserAccount({
                  networkId,
                  accountId,
                });
                backgroundApiProxy.dispatch(
                  addTransaction({
                    accountId: account.id,
                    networkId,
                    transaction: {
                      hash: tx.txid,
                      accountId: account.id,
                      networkId,
                      type: 'lidoStake',
                      nonce: data?.decodedTx?.nonce,
                      addedTime: Date.now(),
                    },
                  }),
                );
                // add stETH to user tokens list
              }
              ToastManager.show({
                title: intl.formatMessage({ id: 'msg__success' }),
              });
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
    },
    [
      source,
      account,
      tokenInfo,
      networkId,
      accountId,
      amount,
      navigation,
      intl,
    ],
  );

  return (
    <Modal
      header={intl.formatMessage(
        { id: 'title__stake_str' },
        { '0': tokenInfo?.symbol.toUpperCase() },
      )}
      primaryActionTranslationId="action__stake"
      hideSecondaryAction
      primaryActionProps={{
        isDisabled:
          !!errorMsg || !!minAmountErrMsg || new BigNumber(amount).lte(0),
      }}
      onPrimaryActionPress={onPrimaryActionPress}
    >
      <Box flex="1">
        <Box flex="1" flexDirection="column" justifyContent="space-between">
          <Center flex="1" flexDirection="column" justifyContent="space-around">
            <Center flexGrow="1" maxH="140px">
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
            <Center flexGrow="0.5" flexShrink="1" flexDirection="column">
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
                  {formatAmount(tokenBalance ?? '', 6)}{' '}
                  {tokenInfo?.symbol.toUpperCase()}
                </Typography.Body2Strong>
              </Box>
            </Center>
            <Box w="full" flexGrow="0.5" flexShrink="1">
              <Box
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                h="10"
              >
                <Typography.Body2 color="text-subdued">
                  {intl.formatMessage({ id: 'form__apy' })}
                </Typography.Body2>
                {aprValue ? (
                  <Typography.Body2 color="text-success">
                    {aprValue}%
                  </Typography.Body2>
                ) : (
                  <Box w="6" h="4" overflow="hidden" borderRadius={12}>
                    <CustomSkeleton />
                  </Box>
                )}
              </Box>
              <Box
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                h="10"
              >
                <Typography.Body2 color="text-subdued">
                  {intl.formatMessage({ id: 'form__protocol' })}
                </Typography.Body2>
                <Pressable onPress={onPress}>
                  <StakingProvderOptions source={source} />
                </Pressable>
              </Box>
            </Box>
          </Center>
        </Box>
        <StakingKeyboard text={amount} onTextChange={setAmount} />
      </Box>
    </Modal>
  );
}
