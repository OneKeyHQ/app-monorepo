import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapProDirectionAtom,
  useSwapProSlippageAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapProTradeType,
  ESwapSlippageSegmentKey,
} from '@onekeyhq/shared/types/swap/types';

import { SlippageSetting } from '../../../Market/MarketDetailV2/components/SwapPanel/components/SlippageSetting';
import { TradeTypeSelector } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TradeTypeSelector';
import SwapProTradeTypeSelector from '../../components/SwapProTradeTypeSelector';
import { useSwapProTokenInit } from '../../hooks/useSwapPro';

import SwapProAccountSelect from './SwapProAccountSelect';
import SwapProActionButton from './SwapProActionButton';
import SwapProInputContainer from './SwapProInputContainer';
import SwapProSlider from './SwapProSlider';
import SwapProTradeInfoGroup from './SwapProTradeInfoGroup';

const SwapProTradingPanel = () => {
  const [swapProDirection, setSwapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType, setSwapProTradeType] = useSwapProTradeTypeAtom();
  const [, setSwapProSliderValue] = useSwapProSlippageAtom();
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

  const navigation = useAppNavigation();
  const handleSelectAccountClick = () => {
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.AccountSelectorStack,
      params: {
        num: 0,
        sceneName: EAccountSelectorSceneName.swap,
      },
    });
  };
  const { defaultTokens, isLoading, speedConfig, isMEV } =
    useSwapProTokenInit();

  const handleSlippageChange = useCallback(
    (item: ISwapSlippageSegmentItem) => {
      if (item.key === ESwapSlippageSegmentKey.AUTO) {
        setSwapProSliderValue(speedConfig?.slippage ?? 0.5);
      } else {
        setSwapProSliderValue(item.value);
      }
    },
    [setSwapProSliderValue, speedConfig?.slippage],
  );
  return (
    <YStack gap="$3" flex={1}>
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
      <SwapProAccountSelect onSelectAccountClick={handleSelectAccountClick} />
      <SlippageSetting
        autoDefaultValue={speedConfig?.slippage}
        isMEV={isMEV}
        onSlippageChange={handleSlippageChange}
      />
      <SwapProActionButton />
    </YStack>
  );
};

export default SwapProTradingPanel;
