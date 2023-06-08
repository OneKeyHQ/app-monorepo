import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet, useWindowDimensions } from 'react-native';

import {
  Box,
  Button,
  Center,
  HStack,
  IconButton,
  Image,
  Keyboard,
  Modal,
  Spinner,
  Text,
  ToastManager,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import KeleLogoPNG from '../../../../assets/staking/kele_pool.png';
import { AutoSizeText } from '../../../components/AutoSizeText';
import {
  FormatBalanceToken,
  FormatCurrencyToken,
  formatBalanceDisplay,
} from '../../../components/Format';
import { useActiveWalletAccount, useNetworkSimple } from '../../../hooks';
import { useSettings } from '../../../hooks/redux';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import {
  useSingleToken,
  useTokenBalanceWithoutFrozen,
} from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { wait } from '../../../utils/helper';
import { StakingRoutes } from '../typing';

import type { StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<StakingRoutesParams, StakingRoutes.StakingAmount>;

export function PreSendAmountPreview({
  title,
  titleAction,
  text,
  onChangeText,
  loading,
  desc,
}: {
  text: string;
  onChangeText?: (text: string) => void;
  title?: string;
  titleAction?: JSX.Element;
  desc?: string | JSX.Element;
  loading?: boolean;
}) {
  return (
    <Box height="140px">
      {!!title && (
        <HStack space={2} alignItems="center" justifyContent="center">
          <Box opacity={0}>{titleAction}</Box>
          <Text
            textAlign="center"
            typography="DisplayLarge"
            color="text-subdued"
          >
            {title}
          </Text>
          {titleAction}
        </HStack>
      )}

      {/* placeholder={intl.formatMessage({ id: 'content__amount' })} */}
      <Center flex={1} maxH="64px" mt={2} mb={3}>
        <AutoSizeText
          autoFocus
          text={text}
          onChangeText={onChangeText}
          placeholder="0"
        />
      </Center>

      {loading ? (
        <Spinner size="sm" />
      ) : (
        !!desc && (
          <Text typography="Body1Strong" textAlign="center" isTruncated>
            {desc}
          </Text>
        )
      )}
    </Box>
  );
}

function usePreSendAmountInfo({
  tokenInfo,
  desc,
  network,
  amount,
  setAmount,
  tokenBalance,
}: {
  tokenInfo: Token | undefined;
  desc?: JSX.Element;
  network?: Network | null;
  amount: string;
  setAmount: (value: string) => void;
  tokenBalance: string;
}) {
  const amountDisplayDecimals =
    (tokenInfo?.tokenIdOnNetwork
      ? network?.tokenDisplayDecimals
      : network?.nativeDisplayDecimals) ?? 2;

  const amountInputDecimals = tokenInfo?.decimals ?? 18;

  const validAmountRegex = useMemo(() => {
    const pattern = `^(0|([1-9][0-9]*))?\\.?([0-9]{1,${amountInputDecimals}})?$`;
    return new RegExp(pattern);
  }, [amountInputDecimals]);

  const { selectedFiatMoneySymbol = 'usd' } = useSettings();
  const fiatUnit = selectedFiatMoneySymbol.toUpperCase().trim();
  const [isFiatMode, setIsFiatMode] = useState(false);

  const textInputDecimals = isFiatMode ? 2 : amountInputDecimals;
  const validTextRegex = useMemo(() => {
    const pattern = `^(0|([1-9][0-9]*))?\\.?([0-9]{1,${textInputDecimals}})?$`;
    return new RegExp(pattern);
  }, [textInputDecimals]);

  const price = useSimpleTokenPriceValue({
    networkId: tokenInfo?.networkId,
    contractAdress: tokenInfo?.tokenIdOnNetwork,
  });

  const [text, setText] = useState(amount);
  const tokenPriceBN = useMemo(() => new BigNumber(price ?? 0), [price]);
  const hasTokenPrice = !tokenPriceBN.isNaN() && tokenPriceBN.gt(0);
  const getInputText = useCallback(
    (isFiatMode0: boolean, amount0: string, roundMode = undefined) => {
      if (isFiatMode0) {
        if (!amount0) {
          return '';
        }
        return tokenPriceBN.times(amount0 || '0').toFixed(2, roundMode);
      }
      return amount0;
    },
    [tokenPriceBN],
  );
  const setTextByAmount = useCallback(
    (amount0: string) => {
      const text0 = getInputText(isFiatMode, amount0, BigNumber.ROUND_FLOOR);
      setText(text0);
    },
    [getInputText, isFiatMode],
  );
  const onTextChange = (text0: string) => {
    // delete action
    if (text0.length < text.length) {
      setText(text0);
      return;
    }
    if (validTextRegex.test(text0)) {
      setText(text0);
    } else {
      const textBN = new BigNumber(text0);
      if (!textBN.isNaN()) {
        const textFixed = textBN.toFixed(
          textInputDecimals,
          BigNumber.ROUND_FLOOR,
        );
        setText(textFixed);
      }
    }
  };
  const onAmountChange = useCallback(
    (text0: string) => {
      // delete action
      if (text0.length < amount.length) {
        setAmount(text0);
        return;
      }
      if (validAmountRegex.test(text0)) {
        setAmount(text0);
      } else {
        const textBN = new BigNumber(text0);
        if (!textBN.isNaN()) {
          const textFixed = textBN.toFixed(
            amountInputDecimals,
            BigNumber.ROUND_FLOOR,
          );
          setAmount(textFixed);
        }
      }
    },
    [amount.length, amountInputDecimals, setAmount, validAmountRegex],
  );
  const titleActionButton = (
    <IconButton
      name="ArrowsUpDownOutline"
      size="lg"
      type="plain"
      circle
      onPress={() => {
        let roundingMode;
        // max amount
        if (text && text === tokenBalance && !isFiatMode) {
          roundingMode = BigNumber.ROUND_FLOOR;
        }
        const isFiatModeNew = !isFiatMode;
        setIsFiatMode(isFiatModeNew);
        setText(getInputText(isFiatModeNew, amount, roundingMode));
      }}
    />
  );
  const descView = useMemo(() => {
    if (desc) {
      return desc;
    }
    if (isFiatMode) {
      return (
        <Text>
          {formatBalanceDisplay(amount || '0', '', {
            fixed: amountDisplayDecimals,
          })?.amount ||
            amount ||
            '0'}{' '}
          {tokenInfo?.symbol}
        </Text>
      );
    }
    return (
      <FormatCurrencyToken
        token={tokenInfo}
        value={amount}
        render={(ele) => <Text>{ele}</Text>}
      />
    );
  }, [amount, amountDisplayDecimals, desc, isFiatMode, tokenInfo]);
  useEffect(() => {
    if (isFiatMode) {
      if (!text) {
        return onAmountChange('');
      }
      return onAmountChange(new BigNumber(text).div(tokenPriceBN).toFixed());
    }
    return onAmountChange(text);
  }, [isFiatMode, onAmountChange, text, tokenPriceBN]);

  return {
    validAmountRegex,
    title: (isFiatMode ? fiatUnit : tokenInfo?.symbol) ?? '--',
    titleAction: hasTokenPrice ? titleActionButton : undefined,
    isFiatMode,
    descView,
    text,
    onTextChange,
    setTextByAmount,
  };
}

export default function StakingAmount() {
  const intl = useIntl();

  const { height } = useWindowDimensions();
  const isSmallScreen = useIsVerticalLayout();
  const [isLoading, setIsLoading] = useState(false);
  const shortScreen = height < 768;
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { networkId, tokenIdOnNetwork } = route.params;
  const [amount, setAmount] = useState('');
  const { account, accountId } = useActiveWalletAccount();
  const network = useNetworkSimple(networkId);

  const { token: tokenInfo } = useSingleToken(
    networkId,
    tokenIdOnNetwork ?? '',
  );

  const tokenBalance = useTokenBalanceWithoutFrozen({
    networkId,
    accountId,
    token: tokenInfo,
    fallback: '0',
  });

  const getAmountValidateError = useCallback(() => {
    if (!tokenInfo || !amount) {
      return 'error';
    }
    const inputBN = new BigNumber(amount);
    const balanceBN = new BigNumber(tokenBalance);
    if (inputBN.isNaN() || balanceBN.isNaN()) {
      return intl.formatMessage(
        { id: 'form__amount_invalid' },
        { 0: tokenInfo?.symbol ?? '' },
      );
    }
    if (balanceBN.isLessThan(inputBN)) {
      return intl.formatMessage(
        { id: 'form__amount_invalid' },
        { 0: tokenInfo?.symbol ?? '' },
      );
    }
    return undefined;
  }, [amount, intl, tokenBalance, tokenInfo]);
  const errorMsg = getAmountValidateError();

  const minAmountBN = useMemo(() => new BigNumber('0.01'), []);

  const [minAmountValidationPassed, minAmountNoticeNeeded] = useMemo(() => {
    const minAmountRequired = !minAmountBN.isNaN() && minAmountBN.gt('0');

    if (minAmountRequired) {
      const amountBN = new BigNumber(amount);
      if (amountBN.isNaN()) {
        return [false, false];
      }
      if (amountBN.lt(minAmountBN)) {
        return [false, amountBN.gt('0')];
      }
    }
    return [true, false];
  }, [minAmountBN, amount]);

  const desc = useMemo(
    () =>
      minAmountNoticeNeeded ? (
        <Typography.Body1Strong color="text-critical">
          {intl.formatMessage(
            { id: 'form__str_minimum_stake_amount' },
            { 0: minAmountBN.toFixed(), 1: tokenInfo?.symbol },
          )}
        </Typography.Body1Strong>
      ) : undefined,
    [intl, minAmountBN, minAmountNoticeNeeded, tokenInfo?.symbol],
  );

  const {
    title,
    titleAction,
    descView,
    text,
    onTextChange,
    validAmountRegex,
    setTextByAmount,
    isFiatMode,
  } = usePreSendAmountInfo({
    tokenInfo,
    desc,
    network,
    amount,
    setAmount,
    tokenBalance,
  });

  return (
    <Modal
      header={intl.formatMessage(
        { id: 'title__stake_str' },
        { '0': tokenInfo?.symbol.toUpperCase() },
      )}
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      primaryActionProps={{
        isDisabled: !!errorMsg || !minAmountValidationPassed,
        isLoading,
      }}
      onPrimaryActionPress={async () => {
        if (!account || !network || !tokenInfo) {
          return;
        }
        const amountToSend = isFiatMode ? amount : text;

        try {
          setIsLoading(true);
          await wait(100);
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Staking,
            params: {
              screen: StakingRoutes.KeleEthStakeShouldUnderstand,
              params: {
                networkId: tokenInfo.networkId,
                tokenIdOnNetwork: tokenInfo.tokenIdOnNetwork,
                amount: amountToSend,
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
      <Box
        flex={1}
        flexDirection="column"
        style={{
          // @ts-ignore
          userSelect: 'none',
        }}
      >
        <Box
          py={isSmallScreen ? 4 : undefined}
          my={6}
          flex={1}
          justifyContent="center"
        >
          <PreSendAmountPreview
            title={title}
            titleAction={titleAction}
            desc={descView}
            text={text}
            onChangeText={onTextChange}
          />
        </Box>
        <Box mt="auto">
          <Box flexDirection="row" alignItems="center">
            <Box flex={1}>
              <Typography.Caption color="text-subdued">
                {intl.formatMessage({ id: 'content__available_balance' })}
              </Typography.Caption>
              <Box>
                <FormatBalanceToken
                  token={tokenInfo}
                  render={(ele) => (
                    <Typography.Body1Strong
                      color={
                        errorMsg && amount ? 'text-critical' : 'text-default'
                      }
                    >
                      {ele}
                    </Typography.Body1Strong>
                  )}
                />
              </Box>
            </Box>
            <Button
              isDisabled={Number(tokenBalance) - 0.01 <= 0}
              onPress={() => {
                const value = Math.max(Number(tokenBalance) - 0.01, 0);
                setTextByAmount(String(value));
              }}
            >
              {intl.formatMessage({ id: 'action__max' })}
            </Button>
          </Box>
          <Box
            borderRadius={12}
            flexDirection="row"
            px="16px"
            py="12px"
            mt="3"
            mb="3"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="border-subdued"
          >
            <Image w="10" h="10" source={KeleLogoPNG} mr="4" />
            <Box>
              <Box flexDirection="row">
                <Typography.Body1>Kele Pool </Typography.Body1>
                <Typography.Body1 color="text-success">
                  4.12% APY
                </Typography.Body1>
              </Box>
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage({ id: 'content__third_party_validator' })}
              </Typography.Body2>
            </Box>
          </Box>
          {(platformEnv.isNative || (platformEnv.isDev && isSmallScreen)) && (
            <Box>
              <Keyboard
                itemHeight={shortScreen ? '44px' : undefined}
                // pattern={/^(0|([1-9][0-9]*))?\.?([0-9]{1,2})?$/}
                pattern={validAmountRegex}
                text={text}
                onTextChange={onTextChange}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Modal>
  );
}
