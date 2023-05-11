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
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';

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
    const pattern = `^(0|([1-9][0-9]*))?\\.?([0-9]{1,${amountInputDecimals}})?$`;
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
    const pattern = `^(0|([1-9][0-9]*))?\\.?([0-9]{1,${textInputDecimals}})?$`;
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
      let normalizedText = text0.replace(/。/g, '.');
      if (platformEnv.isRuntimeBrowser && text0 === '.' && !text) {
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
          const textFixed = textBN.toFixed(
            textInputDecimals,
            BigNumber.ROUND_FLOOR,
          );
          setText(textFixed);
        }
      }
    },
    [text, textInputDecimals, validTextRegex],
  );
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
      <FormatCurrencyTokenOfAccount
        accountId={accountId}
        networkId={networkId}
        token={tokenInfo}
        value={amount}
        render={(ele) => <Text>{ele}</Text>}
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
