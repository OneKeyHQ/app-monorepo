import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { useSwapProTradeTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapProCenterInput from '../../components/SwapProCenterInput';
import { useSwapLimitRate } from '../../hooks/useSwapLimitRate';

const SwapProLimitPriceValue = () => {
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const titleLabel = useMemo(() => {
    return `${intl.formatMessage({ id: ETranslations.global_price })} (${
      currencyInfo.symbol
    })`;
  }, [intl, currencyInfo.symbol]);
  const { onLimitRateChange, limitPriceUseRate } = useSwapLimitRate();
  if (swapProTradeType !== ESwapProTradeType.LIMIT) {
    return null;
  }
  return (
    <SwapProCenterInput
      title={titleLabel}
      value={limitPriceUseRate.inputRate ?? ''}
      onChangeText={onLimitRateChange}
      inputDisabled={false}
    />
  );
};

export default SwapProLimitPriceValue;
