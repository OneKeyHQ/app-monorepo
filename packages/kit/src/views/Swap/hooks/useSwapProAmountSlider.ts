import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { throttle } from 'lodash';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import {
  useSwapNativeTokenReserveGasAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import {
  SWAP_PRO_SLIDER_MAX_PERCENT,
  calcSwapProSliderAmount,
  calcSwapProSliderAvailableBalance,
  calcSwapProSliderPercent,
} from '../utils/swapProAmountSliderUtils';

import { getTokenIdentityKey } from './swapStockChannelUtils';
import { useSwapProInputToken } from './useSwapPro';

// The native slider emits one onChange per integer percent (up to ~100 per
// drag). Committing each one to the global amount atom re-renders the whole
// panel per tick, so mid-drag commits are throttled; release flushes the
// final value immediately.
const SLIDER_COMMIT_THROTTLE_MS = 100;

export function useSwapProAmountSlider({
  inputAmount,
  onAmountChange,
}: {
  inputAmount: string;
  onAmountChange: (text: string) => void;
}) {
  const intl = useIntl();
  const inputToken = useSwapProInputToken();
  const [swapNativeTokenReserveGas] = useSwapNativeTokenReserveGasAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const lastDragPercentRef = useRef(0);

  const reserveGas = useMemo(() => {
    if (!inputToken?.isNative) {
      return undefined;
    }
    return swapNativeTokenReserveGas.find(
      (item) => item.networkId === inputToken.networkId,
    )?.reserveGas;
  }, [inputToken?.isNative, inputToken?.networkId, swapNativeTokenReserveGas]);

  // Use the reserve-deducted balance as the slider base so the mapping stays
  // monotonic: dragging to 100% can never exceed what a max press would allow.
  const availableBalance = useMemo(
    () =>
      calcSwapProSliderAvailableBalance({
        balanceParsed: inputToken?.balanceParsed,
        isNative: inputToken?.isNative,
        reserveGas,
      }),
    [inputToken?.balanceParsed, inputToken?.isNative, reserveGas],
  );

  const isInputBalanceReady = useMemo(() => {
    const balance = new BigNumber(inputToken?.balanceParsed ?? '');
    return balance.isFinite() && balance.gte(0);
  }, [inputToken?.balanceParsed]);
  const sliderDisabled = !inputToken || !isInputBalanceReady;

  // Trade type is part of the key: a trailing commit must not survive a
  // MARKET/LIMIT flip either, since onAmountChange routes to a different
  // amount atom per trade type.
  const inputTokenKey = `${swapProTradeType}_${getTokenIdentityKey(
    inputToken,
  )}`;
  const [zeroBalanceSliderValue, setZeroBalanceSliderValue] = useState(0);
  useEffect(() => {
    setZeroBalanceSliderValue(0);
  }, [availableBalance, inputTokenKey]);
  useEffect(() => {
    if (inputAmount === '') {
      setZeroBalanceSliderValue(0);
    }
  }, [inputAmount]);

  // Positive balances derive the thumb position from the amount so manual
  // typing and keyboard percentage stages stay in sync. A zero balance cannot
  // be used as the divisor, so preserve the user's slider position locally
  // while every positive percentage continues to resolve to amount 0.
  const sliderValue = useMemo(
    () =>
      availableBalance.lte(0)
        ? zeroBalanceSliderValue
        : calcSwapProSliderPercent({
            amount: inputAmount,
            availableBalance,
          }),
    [availableBalance, inputAmount, zeroBalanceSliderValue],
  );
  // Latest inputs for the throttled committer, so the throttle instance can
  // stay stable across renders without capturing stale values. The ref is
  // written during render on purpose — a latest-callback hook such as
  // use-debounce's useThrottledCallback updates only in a passive effect,
  // which would let a trailing edge fire with the previous token's closure
  // in the paint-to-effect gap and defeat the tokenKey guard below.
  const commitContext = {
    availableBalance,
    decimals: inputToken?.decimals,
    onAmountChange,
    inputTokenKey,
  };
  const commitContextRef = useRef(commitContext);
  commitContextRef.current = commitContext;

  const commitPercentThrottled = useMemo(
    () =>
      throttle(
        (percent: number, tokenKey: string) => {
          const ctx = commitContextRef.current;
          // A trailing edge can outlive a token/direction switch inside the
          // throttle window; never write a percent from one token's drag
          // against another token's balance.
          if (ctx.inputTokenKey !== tokenKey) {
            return;
          }
          if (percent <= 0) {
            ctx.onAmountChange('');
            return;
          }
          const amount = calcSwapProSliderAmount({
            percent,
            availableBalance: ctx.availableBalance,
            decimals: ctx.decimals,
          });
          if (amount !== undefined) {
            ctx.onAmountChange(amount);
          }
        },
        SLIDER_COMMIT_THROTTLE_MS,
        { leading: true, trailing: true },
      ),
    [],
  );
  useEffect(
    () => () => commitPercentThrottled.cancel(),
    [commitPercentThrottled],
  );

  const onSliderChange = useCallback(
    (percent: number) => {
      if (sliderDisabled) {
        return;
      }
      lastDragPercentRef.current = percent;
      if (availableBalance.lte(0)) {
        setZeroBalanceSliderValue(percent);
      }
      commitPercentThrottled(percent, commitContextRef.current.inputTokenKey);
    },
    [availableBalance, sliderDisabled, commitPercentThrottled],
  );

  // Each gesture starts from a clean slate so a tap/long-press that emits no
  // onChange can't reuse the previous drag's percent.
  const onSlideStart = useCallback(() => {
    lastDragPercentRef.current = 0;
  }, []);

  // Toast once on release at 100% instead of during the drag, mirroring the
  // native-token reserve tips shown by the balance max press.
  const onSlideComplete = useCallback(() => {
    // Land the final drag value immediately instead of waiting out the
    // throttle window.
    commitPercentThrottled.flush();
    const releasedAtMax =
      lastDragPercentRef.current >= SWAP_PRO_SLIDER_MAX_PERCENT &&
      !sliderDisabled &&
      availableBalance.gt(0);
    // Consume the gesture's percent so a later release without any onChange
    // (tap on the current mark, long-press) can't re-trigger the toast.
    lastDragPercentRef.current = 0;
    if (!releasedAtMax || !inputToken?.isNative) {
      return;
    }
    const reserveGasBN = new BigNumber(reserveGas ?? '');
    if (reserveGasBN.isFinite() && reserveGasBN.gt(0)) {
      const reserveGasFormatted = numberFormat(reserveGasBN.toFixed(), {
        formatter: 'balance',
        formatterOptions: {
          tokenSymbol: inputToken?.symbol,
        },
      });
      Toast.message({
        title: intl.formatMessage(
          { id: ETranslations.swap_native_token_max_tip_already },
          { num_token: reserveGasFormatted },
        ),
      });
      return;
    }
    // Native token without a configured reserve: 100% drains the gas budget,
    // so surface the generic warning the balance max press shows.
    Toast.message({
      title: intl.formatMessage({
        id: ETranslations.swap_native_token_max_tip,
      }),
    });
  }, [
    commitPercentThrottled,
    sliderDisabled,
    availableBalance,
    reserveGas,
    inputToken?.isNative,
    inputToken?.symbol,
    intl,
  ]);

  return {
    sliderValue,
    sliderDisabled,
    onSliderChange,
    onSlideStart,
    onSlideComplete,
  };
}
