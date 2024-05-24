import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import { IconButton, Text } from '@onekeyhq/components';
import type { INetwork } from '@onekeyhq/engine/src/types';
import type { Token } from '@onekeyhq/engine/src/types/token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  FormatCurrencyTokenOfAccount,
  formatBalanceDisplay,
} from '../../../components/Format';
import { useSettings } from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useTokens';

export function usePreSendAmountInfo({
  tokenInfo,
  desc,
  network,
  amount,
  setAmount,
  tokenBalance,
  networkId,
  accountId,
}: {
  tokenInfo: Token | undefined;
  desc?: JSX.Element;
  network?: INetwork | null;
  amount: string;
  setAmount: (value: string) => void;
  tokenBalance: string;
  accountId: string;
  networkId: string;
}) {
  const amountDisplayDecimals =
    (tokenInfo?.tokenIdOnNetwork
      ? network?.tokenDisplayDecimals
      : network?.nativeDisplayDecimals) ?? 2;

  const amountInputDecimals = tokenInfo?.decimals ?? 18;

  const validAmountRegex = useMemo(() => {
    let pattern = `^(0|([1-9][0-9]*))?\\.?([0-9]{1,${amountInputDecimals}})?$`;
    if (amountInputDecimals === 0) {
      pattern = '^(0|([1-9][0-9]*))?$';
    }
    return new RegExp(pattern);
  }, [amountInputDecimals]);

  const tokenPrice = useSimpleTokenPriceValue({
    networkId,
    contractAdress: tokenInfo?.tokenIdOnNetwork,
  });
  const { selectedFiatMoneySymbol = 'usd' } = useSettings();
  const fiatUnit = selectedFiatMoneySymbol.toUpperCase().trim();
  const [isFiatMode, setIsFiatMode] = useState(false);
  const fiatModeDecimal = selectedFiatMoneySymbol === 'btc' ? 8 : 2;
  const textInputDecimals = isFiatMode ? fiatModeDecimal : amountInputDecimals;
  const validTextRegex = useMemo(() => {
    let pattern = `^(0|([1-9][0-9]*))?\\.?([0-9]{1,${textInputDecimals}})?$`;
    if (textInputDecimals === 0) {
      pattern = '^(0|([1-9][0-9]*))?$';
    }
    return new RegExp(pattern);
  }, [textInputDecimals]);

  const [text, setText] = useState(amount);
  const tokenPriceBN = useMemo(
    () =>
      // new BigNumber(
      //   getTokenPrice({
      //     token: tokenInfo,
      //     fiatSymbol: selectedFiatMoneySymbol,
      //   }),
      // ),
      new BigNumber(tokenPrice ?? 0),
    [tokenPrice],
  );
  const hasTokenPrice = !tokenPriceBN.isNaN() && tokenPriceBN.gt(0);
  const getInputText = useCallback(
    (isFiatMode0: boolean, amount0: string, roundMode = undefined) => {
      if (isFiatMode0) {
        if (!amount0) {
          return '';
        }
        return tokenPriceBN
          .times(amount0 || '0')
          .toFixed(textInputDecimals, roundMode);
      }
      return amount0;
    },
    [textInputDecimals, tokenPriceBN],
  );
  const setTextByAmount = useCallback(
    (amount0: string) => {
      const text0 = getInputText(isFiatMode, amount0, BigNumber.ROUND_FLOOR);
      setText(text0);
    },
    [getInputText, isFiatMode],
  );
  const onTextChange = useCallback(
    (text0: string) => {
      let amountText = text0;
      const amountTextBN = new BigNumber(amountText);
      if (!amountTextBN.isNaN() && amountTextBN.isNegative()) {
        amountText = amountTextBN.abs().toFixed();
      }

      let normalizedText = amountText.replace(/。/g, '.');
      if (platformEnv.isRuntimeBrowser && amountText === '.' && !text) {
        normalizedText = '0.';
      }
      // delete action
      if (normalizedText.length < text.length) {
        setText(normalizedText);
        return;
      }
      if (validTextRegex.test(normalizedText)) {
        setText(normalizedText);
      } else {
        const textBN = new BigNumber(normalizedText);
        if (!textBN.isNaN()) {
          const textFixed = textBN
            .abs()
            .toFixed(textInputDecimals, BigNumber.ROUND_FLOOR);
          setText(textFixed);
        }
      }
    },
    [text, textInputDecimals, validTextRegex],
  );
  const onAmountChange = useCallback(
    (text0: string) => {
      let amountText = text0;
      const amountTextBN = new BigNumber(amountText);

      if (!amountTextBN.isNaN() && amountTextBN.isNegative()) {
        amountText = amountTextBN.abs().toFixed();
      }

      // delete action
      if (amountText.length < amount.length) {
        setAmount(amountText);
        return;
      }
      if (validAmountRegex.test(amountText)) {
        setAmount(amountText);
      } else {
        const textBN = new BigNumber(amountText);
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
        <Text numberOfLines={2} textAlign="center">
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
      <FormatCurrencyTokenOfAccount
        accountId={accountId}
        networkId={networkId}
        token={tokenInfo}
        value={amount}
        render={(ele) => (
          <Text numberOfLines={2} textAlign="center">
            {ele}
          </Text>
        )}
      />
    );
  }, [
    accountId,
    amount,
    amountDisplayDecimals,
    desc,
    isFiatMode,
    networkId,
    tokenInfo,
  ]);
  useEffect(() => {
    // isFiatMode calculate fiat value
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
