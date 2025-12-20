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
import { SwapProSlippageSetting } from './SwapProSlippageSetting';
import SwapProTradeInfoGroup from './SwapProTradeInfoGroup';

interface ISwapProTradingPanelProps {
  swapProConfig: ISwapProSpeedConfig;
  balanceLoading: boolean;
  configLoading: boolean;
  isMev: boolean;
  onSwapProActionClick: () => void;
  hasEnoughBalance: boolean;
  handleSelectAccountClick: () => void;
  cleanInputAmount: () => void;
}

const SwapProTradingPanel = ({
  swapProConfig,
  balanceLoading,
  isMev,
  configLoading,
  onSwapProActionClick,
  handleSelectAccountClick,
  hasEnoughBalance,
  cleanInputAmount,
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
    <YStack gap="$2.5" flex={1} justifyContent="space-between">
      <TradeTypeSelector
        value={swapProDirection}
        size="small"
        onChange={(value) => {
          if (value) {
            cleanInputAmount();
            setSwapProDirection(value);
          }
        }}
      />
      <YStack gap="$2">
        <SwapProTradeTypeSelector
          currentSelect={swapProTradeType}
          onSelectTradeType={(value) => {
            if (value === swapProTradeType) return;
            cleanInputAmount();
            setSwapProTradeType(value);
          }}
          selectItems={selectTradeTypeItems}
        />
        {swapProTradeType === ESwapProTradeType.LIMIT ? (
          <SwapProLimitPriceValue />
        ) : null}
        <SwapProInputContainer
          isLoading={configLoading}
          defaultTokens={swapProConfig.defaultTokens}
          defaultLimitTokens={swapProConfig.defaultLimitTokens}
          cleanInputAmount={cleanInputAmount}
        />
      </YStack>
      <YStack>
        {/* <SwapProToTotalValue /> */}
        <SwapProTradeInfoGroup balanceLoading={balanceLoading} />
        <SwapProAccountSelect onSelectAccountClick={handleSelectAccountClick} />
        <SwapProSlippageSetting isMEV={isMev} />
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
      <SwapProActionButton
        onSwapProActionClick={onSwapProActionClick}
        hasEnoughBalance={hasEnoughBalance}
        balanceLoading={balanceLoading}
      />
    </YStack>
  );
};

export default SwapProTradingPanel;
