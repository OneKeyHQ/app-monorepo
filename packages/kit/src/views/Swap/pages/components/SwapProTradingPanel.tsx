import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, YStack } from '@onekeyhq/components';
import {
  useSwapLimitExpirationTimeAtom,
  useSwapLimitPartiallyFillAtom,
  useSwapProDirectionAtom,
  useSwapProTokenSupportLimitAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapProSpeedConfig } from '@onekeyhq/shared/types/swap/types';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import { TradeTypeSelector } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TradeTypeSelector';
import LimitExpirySelect from '../../components/LimitExpirySelect';
import LimitPartialFillSelect from '../../components/LimitPartialFillSelect';
import SwapProTradeTypeSelector from '../../components/SwapProTradeTypeSelector';
import { useSwapLimitConfigMaps } from '../../hooks/useSwapGlobal';
import { useSwapProActionsQuote } from '../../hooks/useSwapPro';

import SwapProAccountSelect from './SwapProAccountSelect';
import SwapProActionButton from './SwapProActionButton';
import SwapProInputContainer from './SwapProInputContainer';
import SwapProLimitPriceValue from './SwapProLimitPriceValue';
import SwapProSlider from './SwapProSlider';
import { SwapProSlippageSetting } from './SwapProSlippageSetting';
import SwapProToTotalValue from './SwapProToTotalValue';
import SwapProTradeInfoGroup from './SwapProTradeInfoGroup';

import type { IToken } from '../../../Market/MarketDetailV2/components/SwapPanel/types';

interface ISwapProTradingPanelProps {
  swapProConfig: ISwapProSpeedConfig;
  balanceLoading: boolean;
  configLoading: boolean;
  isMev: boolean;
  onSwapProActionClick: () => void;
  hasEnoughBalance: boolean;
  handleSelectAccountClick: () => void;
}

const SwapProTradingPanel = ({
  swapProConfig,
  balanceLoading,
  isMev,
  configLoading,
  onSwapProActionClick,
  handleSelectAccountClick,
  hasEnoughBalance,
}: ISwapProTradingPanelProps) => {
  const [swapProDirection, setSwapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType, setSwapProTradeType] = useSwapProTradeTypeAtom();
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

  useSwapProActionsQuote();

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
          isLoading={configLoading}
          defaultTokens={swapProConfig.defaultTokens as IToken[]}
        />
        <SwapProSlider />
        <SwapProToTotalValue />
        <SwapProTradeInfoGroup balanceLoading={balanceLoading} />
        <SwapProAccountSelect onSelectAccountClick={handleSelectAccountClick} />
        <SwapProSlippageSetting
          autoDefaultValue={swapProConfig?.slippage}
          isMEV={isMev}
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
      <SwapProActionButton
        onSwapProActionClick={onSwapProActionClick}
        hasEnoughBalance={hasEnoughBalance}
        balanceLoading={balanceLoading}
      />
    </YStack>
  );
};

export default SwapProTradingPanel;
