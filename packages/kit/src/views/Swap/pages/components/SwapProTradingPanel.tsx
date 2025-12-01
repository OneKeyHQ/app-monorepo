import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapLimitExpirationTimeAtom,
  useSwapLimitPartiallyFillAtom,
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

import { TradeTypeSelector } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TradeTypeSelector';
import LimitExpirySelect from '../../components/LimitExpirySelect';
import LimitPartialFillSelect from '../../components/LimitPartialFillSelect';
import SwapProTradeTypeSelector from '../../components/SwapProTradeTypeSelector';
import { useSwapLimitConfigMaps } from '../../hooks/useSwapGlobal';
import { useSwapProTokenInit } from '../../hooks/useSwapPro';

import SwapProAccountSelect from './SwapProAccountSelect';
import SwapProActionButton from './SwapProActionButton';
import SwapProInputContainer from './SwapProInputContainer';
import SwapProLimitPriceValue from './SwapProLimitPriceValue';
import SwapProSlider from './SwapProSlider';
import { SwapProSlippageSetting } from './SwapProSlippageSetting';
import SwapProToTotalValue from './SwapProToTotalValue';
import SwapProTradeInfoGroup from './SwapProTradeInfoGroup';

const SwapProTradingPanel = () => {
  const [swapProDirection, setSwapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType, setSwapProTradeType] = useSwapProTradeTypeAtom();
  const [swapLimitExpirySelect, setSwapLimitExpirySelect] =
    useSwapLimitExpirationTimeAtom();
  const [swapLimitPartiallyFill, setSwapLimitPartiallyFill] =
    useSwapLimitPartiallyFillAtom();
  const [, setSwapProSliderValue] = useSwapProSlippageAtom();
  const { limitOrderExpiryStepMap, limitOrderPartiallyFillStepMap } =
    useSwapLimitConfigMaps();
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
    <YStack gap="$2" flex={1} justifyContent="space-between">
      <YStack gap="$2">
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
        {swapProTradeType === ESwapProTradeType.LIMIT ? (
          <SwapProLimitPriceValue />
        ) : null}
        <SwapProInputContainer
          isLoading={isLoading}
          defaultTokens={defaultTokens}
        />
        <SwapProSlider />
        <SwapProToTotalValue />
        <SwapProTradeInfoGroup />
        <SwapProAccountSelect onSelectAccountClick={handleSelectAccountClick} />
        <SwapProSlippageSetting
          autoDefaultValue={speedConfig?.slippage}
          isMEV={isMEV}
          onSlippageChange={handleSlippageChange}
        />
        {swapProTradeType === ESwapProTradeType.LIMIT ? (
          <>
            <LimitExpirySelect
              currentSelectExpiryValue={swapLimitExpirySelect}
              onSelectExpiryValue={setSwapLimitExpirySelect}
              selectItems={limitOrderExpiryStepMap}
              leftIcon={
                <Icon
                  name="ClockTimeHistoryOutline"
                  size="$4"
                  color="$iconSubdued"
                />
              }
              titleProps={{
                size: '$bodySm',
              }}
              valueProps={{
                size: '$bodySm',
                color: '$textSubdued',
              }}
              rightIcon={
                <Icon
                  name="ChevronRightSmallOutline"
                  size="$4"
                  color="$iconSubdued"
                />
              }
            />
            <LimitPartialFillSelect
              currentSelectPartiallyFillValue={swapLimitPartiallyFill}
              onSelectPartiallyFillValue={setSwapLimitPartiallyFill}
              selectItems={limitOrderPartiallyFillStepMap}
              leftIcon={
                <Icon
                  name="CirclePlaceholderOnOutline"
                  size="$4"
                  color="$iconSubdued"
                />
              }
              titleProps={{
                size: '$bodySm',
              }}
              valueProps={{
                size: '$bodySm',
                color: '$textSubdued',
              }}
              rightIcon={
                <Icon
                  name="ChevronRightSmallOutline"
                  size="$4"
                  color="$iconSubdued"
                />
              }
            />
          </>
        ) : null}
      </YStack>
      <SwapProActionButton />
    </YStack>
  );
};

export default SwapProTradingPanel;
