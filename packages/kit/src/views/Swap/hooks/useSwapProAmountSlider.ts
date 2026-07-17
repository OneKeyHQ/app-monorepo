import { useCallback, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { useSwapNativeTokenReserveGasAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import {
  SWAP_PRO_SLIDER_MAX_PERCENT,
  calcSwapProSliderAmount,
  calcSwapProSliderAvailableBalance,
  calcSwapProSliderPercent,
} from '../utils/swapProAmountSliderUtils';

import { useSwapProInputToken } from './useSwapPro';

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

  const sliderDisabled = availableBalance.lte(0);

  // Derive the thumb position from the amount instead of storing it, so manual
  // typing, keyboard percentage stages and token switches stay in sync without
  // extra reset wiring. The native slider skips external syncs mid-drag.
  const sliderValue = useMemo(
    () =>
      calcSwapProSliderPercent({
        amount: inputAmount,
        availableBalance,
      }),
    [inputAmount, availableBalance],
  );

  const onSliderChange = useCallback(
    (percent: number) => {
      lastDragPercentRef.current = percent;
      if (sliderDisabled) {
        return;
      }
      if (percent <= 0) {
        onAmountChange('');
        return;
      }
      const amount = calcSwapProSliderAmount({
        percent,
        availableBalance,
        decimals: inputToken?.decimals,
      });
      if (amount !== undefined) {
        onAmountChange(amount);
      }
    },
    [sliderDisabled, availableBalance, inputToken?.decimals, onAmountChange],
  );

  // Toast once on release at 100% instead of during the drag, mirroring the
  // native-token reserve tip shown by the balance max press.
  const onSlideComplete = useCallback(() => {
    const reserveGasBN = new BigNumber(reserveGas ?? '');
    if (
      lastDragPercentRef.current >= SWAP_PRO_SLIDER_MAX_PERCENT &&
      reserveGasBN.isFinite() &&
      reserveGasBN.gt(0) &&
      !sliderDisabled
    ) {
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
    }
  }, [reserveGas, sliderDisabled, inputToken?.symbol, intl]);

  return {
    sliderValue,
    sliderDisabled,
    onSliderChange,
    onSlideComplete,
  };
}
