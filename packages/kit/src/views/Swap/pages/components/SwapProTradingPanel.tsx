import { useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
import {
  useSwapProDirectionAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import { TokenInputSection } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection';
import { TradeTypeSelector } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TradeTypeSelector';
import { useSpeedSwapActions } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useSpeedSwapActions';
import {
  ESwapDirection,
  ITradeType,
} from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import SwapProTradeTypeSelector from '../../components/SwapProTradeTypeSelector';

import type { ITokenInputSectionRef } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection';

const SwapProTradingPanel = () => {
  const [swapProDirection, setSwapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType, setSwapProTradeType] = useSwapProTradeTypeAtom();
  const intl = useIntl();
  const tokenInputRef = useRef<ITokenInputSectionRef>(null);
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
  //   const useSpeedSwapActionsParams = {
  //     slippage,
  //     spenderAddress: speedConfig.spenderAddress,
  //     marketToken: {
  //       networkId: networkId || '',
  //       contractAddress: tokenDetail?.address || '',
  //       symbol: tokenDetail?.symbol || '',
  //       decimals: tokenDetail?.decimals || 0,
  //       logoURI: tokenDetail?.logoUrl || '',
  //       price: tokenDetail?.price || '',
  //     },
  //     tradeToken: {
  //       networkId: paymentToken?.networkId || '',
  //       contractAddress: paymentToken?.contractAddress || '',
  //       symbol: paymentToken?.symbol || '',
  //       decimals: paymentToken?.decimals || 0,
  //       logoURI: paymentToken?.logoURI || '',
  //       isNative: paymentToken?.isNative || false,
  //     },
  //     defaultTradeTokens: defaultTokens,
  //     provider,
  //     tradeType: tradeType || ESwapDirection.BUY,
  //     fromTokenAmount: paymentAmount.toFixed(),
  //     antiMEV: swapMevNetConfig?.includes(swapPanel.networkId ?? ''),
  //     onCloseDialog,
  //   };

  //   const speedSwapActions = useSpeedSwapActions(useSpeedSwapActionsParams);

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
      {/* <TokenInputSection
        ref={tokenInputRef}
        tradeType={swapProDirection}
        swapNativeTokenReserveGas={swapNativeTokenReserveGas}
        onChange={(amount) => setPaymentAmount(new BigNumber(amount))}
        selectedToken={
          tradeType === ESwapDirection.SELL ? balanceToken : paymentToken
        }
        selectableTokens={defaultTokens}
        onTokenChange={(token) => setPaymentToken(token)}
        balance={balance}
        onAmountEnterTypeChange={swapAnalytics.setAmountEnterType}
      /> */}
    </YStack>
  );
};

export default SwapProTradingPanel;
