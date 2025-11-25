import { useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
import {
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import { TradeTypeSelector } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TradeTypeSelector';
import { PerpsSlider } from '../../../Perp/components/PerpsSlider';
import SwapProTradeTypeSelector from '../../components/SwapProTradeTypeSelector';
import { useSwapProTokenInit } from '../../hooks/useSwapPro';

import SwapProInputContainer from './SwapProInputContainer';
import SwapProSlider from './SwapProSlider';
import SwapProTradeInfoGroup from './SwapProTradeInfoGroup';

const SwapProTradingPanel = () => {
  const [swapProDirection, setSwapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType, setSwapProTradeType] = useSwapProTradeTypeAtom();
  const intl = useIntl();
  const selectTradeTypeItems = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.perp_trade_market }),
        value: ESwapProTradeType.MARKET,
      },
      {
        label: intl.formatMessage({ id: ETranslations.perp_trade_limit }),
        value: ESwapProTradeType.LIMIT,
      },
    ],
    [intl],
  );
  const { defaultTokens, isLoading } = useSwapProTokenInit();

  return (
    <YStack gap="$3">
      <TradeTypeSelector
        value={swapProDirection}
        onChange={(value) => {
          if (value) {
            setSwapProDirection(value);
          }
        }}
      />
      <SwapProTradeTypeSelector
        currentSelect={swapProTradeType}
        onSelectTradeType={setSwapProTradeType}
        selectItems={selectTradeTypeItems}
      />
      <SwapProInputContainer
        isLoading={isLoading}
        defaultTokens={defaultTokens}
      />
      <SwapProSlider />
      <SwapProTradeInfoGroup />
    </YStack>
  );
};

export default SwapProTradingPanel;
