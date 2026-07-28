import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Icon, YStack } from '@onekeyhq/components';
import {
  useSwapFromTokenAmountAtom,
  useSwapLimitExpirationTimeAtom,
  useSwapLimitPartiallyFillAtom,
  useSwapProDirectionAtom,
  useSwapProInputAmountAtom,
  useSwapProSelectTokenAtom,
  useSwapProTokenSupportLimitAtom,
  useSwapProTradeTypeAtom,
  useSwapProUseSelectBuyTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapProSpeedConfig } from '@onekeyhq/shared/types/swap/types';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import { TradeTypeSelector } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TradeTypeSelector';
import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import LimitExpirySelect from '../../components/LimitExpirySelect';
import LimitPartialFillSelect from '../../components/LimitPartialFillSelect';
import SwapProTradeTypeSelector from '../../components/SwapProTradeTypeSelector';
import { getTokenIdentityKey } from '../../hooks/swapStockChannelUtils';
import { useSwapLimitConfigMaps } from '../../hooks/useSwapGlobal';
import { useSwapProActionsQuote } from '../../hooks/useSwapPro';

import SwapProAccountSelect from './SwapProAccountSelect';
import SwapProActionButton from './SwapProActionButton';
import SwapProInputContainer from './SwapProInputContainer';
import SwapProLimitPriceValue from './SwapProLimitPriceValue';
import SwapProPayTokenSelector from './SwapProPayTokenSelector';
import SwapProPresetSelector from './SwapProPresetSelector';
import { SwapProSlippageSetting } from './SwapProSlippageSetting';
import SwapProTradeInfoGroup from './SwapProTradeInfoGroup';

import type { IEstimateMarketPresetPriorityFeeFiatValues } from '../../../Market/MarketDetailV2/components/SwapPanel/components/MarketPresetSelector';
import type { IMarketPresetSettingsState } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useMarketPresetSettings';
import type { ITradeType } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';

interface ISwapProTradingPanelProps {
  swapProConfig: ISwapProSpeedConfig;
  balanceLoading: boolean;
  configLoading: boolean;
  configReady: boolean;
  supportSpeedSwap: boolean;
  onSwapProActionClick: () => void;
  hasEnoughBalance: boolean;
  handleSelectAccountClick: () => void;
  cleanInputAmount: () => void;
  onBalanceMax: () => void;
  onSelectPercentageStage: (stage: number) => void;
  limitPriceUseMarketPrice: { value: string; change: boolean };
  marketPresetSettings?: IMarketPresetSettingsState;
  showMarketPresetSelector?: boolean;
  antiMEV?: boolean;
  estimatePriorityFeeFiatValues?: IEstimateMarketPresetPriorityFeeFiatValues;
}

const SwapProTradingPanel = ({
  supportSpeedSwap,
  swapProConfig,
  balanceLoading,
  configLoading,
  configReady,
  onBalanceMax,
  onSwapProActionClick,
  handleSelectAccountClick,
  onSelectPercentageStage,
  limitPriceUseMarketPrice,
  hasEnoughBalance,
  cleanInputAmount,
  marketPresetSettings,
  showMarketPresetSelector,
  antiMEV,
  estimatePriorityFeeFiatValues,
}: ISwapProTradingPanelProps) => {
  const [swapProDirection, setSwapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType, setSwapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProUseSelectBuyToken] = useSwapProUseSelectBuyTokenAtom();
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  // Per-direction amount stash: switching BUY/SELL restores what was typed on
  // that side instead of clearing it (the two sides denominate in different
  // tokens, so the values must never be shared directly). Each entry carries
  // the context it was typed in (trade type + that side's input token); a
  // restore only applies when the context still matches, so amounts can never
  // resurrect across trade-type or pay-token switches in a different
  // denomination.
  const stashedAmountsRef = useRef<
    Partial<Record<ESwapDirection, { value: string; contextKey: string }>>
  >({});
  useEffect(() => {
    // Stashed amounts belong to one traded token; drop them on token switch.
    stashedAmountsRef.current = {};
  }, [swapProSelectToken?.networkId, swapProSelectToken?.contractAddress]);
  const [swapLimitExpirySelect, setSwapLimitExpirySelect] =
    useSwapLimitExpirationTimeAtom();
  const [swapLimitPartiallyFill, setSwapLimitPartiallyFill] =
    useSwapLimitPartiallyFillAtom();
  const { limitOrderExpiryStepMap, limitOrderPartiallyFillStepMap } =
    useSwapLimitConfigMaps();
  const intl = useIntl();
  const [swapProTokenSupportLimit] = useSwapProTokenSupportLimitAtom();
  const selectTradeTypeItems = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.perp_trade_market }),
        value: ESwapProTradeType.MARKET,
      },
      {
        label: intl.formatMessage({ id: ETranslations.perp_trade_limit }),
        value: ESwapProTradeType.LIMIT,
        disabled: !swapProTokenSupportLimit,
        description: swapProTokenSupportLimit
          ? undefined
          : intl.formatMessage({
              id: ETranslations.dexmarket_pro_limit_desc,
            }),
      },
    ],
    [intl, swapProTokenSupportLimit],
  );

  const onTypeSelected = useCallback(
    (value: ESwapProTradeType) => {
      if (value === swapProTradeType) return;
      cleanInputAmount();
      setSwapProTradeType(value);
    },
    [cleanInputAmount, setSwapProTradeType, swapProTradeType],
  );

  const onDirectionSelected = useCallback(
    (value: ITradeType) => {
      if (!value || value === swapProDirection) return;
      // Stash this side's typed amount and restore what the target side had
      // (empty when it was never typed) — the sides denominate in different
      // tokens, so each keeps its own value instead of sharing or clearing.
      const buildStashContextKey = (direction: ESwapDirection) => {
        const directionInputToken =
          direction === ESwapDirection.BUY
            ? swapProUseSelectBuyToken
            : swapProSelectToken;
        return `${swapProTradeType}_${getTokenIdentityKey(
          directionInputToken,
        )}`;
      };
      const isMarket = swapProTradeType === ESwapProTradeType.MARKET;
      stashedAmountsRef.current[swapProDirection] = {
        value: isMarket ? swapProInputAmount : fromInputAmount.value,
        contextKey: buildStashContextKey(swapProDirection),
      };
      const targetStash = stashedAmountsRef.current[value];
      const restored =
        targetStash && targetStash.contextKey === buildStashContextKey(value)
          ? targetStash.value
          : '';
      setSwapProInputAmount(isMarket ? restored : '');
      setFromInputAmount({
        value: isMarket ? '' : restored,
        isInput: true,
      });
      setSwapProDirection(value);
    },
    [
      swapProDirection,
      swapProTradeType,
      swapProInputAmount,
      fromInputAmount.value,
      swapProUseSelectBuyToken,
      swapProSelectToken,
      setSwapProInputAmount,
      setFromInputAmount,
      setSwapProDirection,
    ],
  );
  const isMarketPresetActionDisabled =
    swapProTradeType === ESwapProTradeType.MARKET &&
    !!marketPresetSettings?.isLoading;

  useSwapProActionsQuote();

  return (
    <YStack gap="$2.5" flex={1}>
      <TradeTypeSelector
        value={swapProDirection}
        size="small"
        onChange={onDirectionSelected}
      />
      <YStack gap="$2">
        <SwapProTradeTypeSelector
          currentSelect={swapProTradeType}
          onSelectTradeType={onTypeSelected}
          selectItems={selectTradeTypeItems}
        />
        <SwapProPayTokenSelector
          defaultTokens={swapProConfig.defaultTokens}
          defaultLimitTokens={swapProConfig.defaultLimitTokens}
          cleanInputAmount={cleanInputAmount}
          configReady={configReady}
        />
        {swapProTradeType === ESwapProTradeType.LIMIT ? (
          <SwapProLimitPriceValue
            externalTokenPrice={limitPriceUseMarketPrice}
          />
        ) : null}
        <SwapProInputContainer
          isLoading={configLoading}
          onSelectPercentageStage={onSelectPercentageStage}
        />
      </YStack>
      <YStack>
        <SwapProTradeInfoGroup
          balanceLoading={balanceLoading}
          onBalanceMax={onBalanceMax}
        />
        <SwapProAccountSelect onSelectAccountClick={handleSelectAccountClick} />
        {swapProTradeType === ESwapProTradeType.MARKET ? (
          <YStack h="$6">
            {showMarketPresetSelector && marketPresetSettings ? (
              <SwapProPresetSelector
                antiMEV={antiMEV}
                estimatePriorityFeeFiatValues={estimatePriorityFeeFiatValues}
                presetSettings={marketPresetSettings}
              />
            ) : null}
            {/* Networks without an enabled market preset still quote with the
                global slippage state, so keep the plain slippage entry visible
                there — the preset selector replaces it only when presets are on. */}
            {!marketPresetSettings ||
            (!marketPresetSettings.enabled &&
              !marketPresetSettings.isLoading) ? (
              <SwapProSlippageSetting isMEV={!!antiMEV} />
            ) : null}
          </YStack>
        ) : null}
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
                color: '$textSubdued',
              }}
              valueProps={{
                size: '$bodySm',
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
                color: '$textSubdued',
              }}
              valueProps={{
                size: '$bodySm',
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
      {/* Collect the column's spare height here (instead of space-between)
          so the groups above keep fixed, symmetric spacing and only the
          action button is pushed to the bottom. */}
      <YStack flex={1} />
      <SwapProActionButton
        onSwapProActionClick={onSwapProActionClick}
        hasEnoughBalance={hasEnoughBalance}
        balanceLoading={balanceLoading}
        supportSpeedSwap={supportSpeedSwap}
        isActionDisabled={isMarketPresetActionDisabled}
      />
    </YStack>
  );
};

export default SwapProTradingPanel;
