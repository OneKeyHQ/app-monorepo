import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';
import type { useSwapPanel } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useSwapPanel';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ActionButton } from './components/ActionButton';
import { AntiMEVToggle } from './components/AntiMEVToggle';
import { ApproveButton } from './components/ApproveButton';
import { BalanceDisplay } from './components/BalanceDisplay';
import { SlippageSetting } from './components/SlippageSetting';
import { SwapTestPanel } from './components/SwapTestPanel';
import { TokenInputSection } from './components/TokenInputSection';
import { TradeTypeSelector } from './components/TradeTypeSelector';
import { UnsupportedSwapWarning } from './components/UnsupportedSwapWarning';

export type ISwapPanelContentProps = {
  swapPanel: ReturnType<typeof useSwapPanel>;
  isLoading: boolean;
  slippageAutoValue?: number;
  supportSpeedSwap: boolean;
  isApproved: boolean;
  defaultTokens: IToken[];
  balance: BigNumber;
  balanceToken?: IToken;
  onApprove: () => void;
  onSwap: () => void;
};

export function SwapPanelContent(props: ISwapPanelContentProps) {
  const {
    swapPanel,
    isLoading,
    slippageAutoValue,
    supportSpeedSwap,
    defaultTokens,
    isApproved,
    balance,
    balanceToken,
    onApprove,
    onSwap,
  } = props;

  const {
    paymentAmount,
    paymentToken,
    setPaymentAmount,
    setPaymentToken,
    antiMEV,
    handleAntiMEVToggle,
    tradeType,
    setTradeType,
    setSlippage,
  } = swapPanel;

  return (
    <YStack gap="$4" p="$4" maxWidth="$100">
      {/* Trade type selector */}
      <TradeTypeSelector value={tradeType} onChange={setTradeType} />

      {/* Token input section */}
      <TokenInputSection
        tradeType={tradeType}
        value={paymentAmount.toFixed()}
        onChange={(amount) => setPaymentAmount(new BigNumber(amount))}
        selectedToken={paymentToken}
        selectableTokens={defaultTokens}
        onTokenChange={(token) => setPaymentToken(token)}
      />

      {/* Balance display */}
      <BalanceDisplay balance={balance} token={balanceToken} />

      {/* Unsupported swap warning */}
      {!supportSpeedSwap ? <UnsupportedSwapWarning /> : null}

      {!isApproved ? (
        <ApproveButton onApprove={onApprove} />
      ) : (
        <ActionButton
          disabled={!supportSpeedSwap}
          loading={isLoading}
          tradeType={tradeType}
          onPress={onSwap}
          amount={paymentAmount.toFixed()}
          token={paymentToken}
          totalValue={888} // TODO: Replace with actual totalValue
        />
      )}

      {/* Slippage setting */}
      <SlippageSetting
        autoDefaultValue={slippageAutoValue}
        isMEV={antiMEV}
        onSlippageChange={(item) => setSlippage(item.value)}
      />

      {/* AntiMEV toggle */}
      <AntiMEVToggle value={antiMEV} onToggle={handleAntiMEVToggle} />

      {/* Test - Only in Dev Mode */}
      {platformEnv.isDev ? <SwapTestPanel swapPanel={swapPanel} /> : null}
    </YStack>
  );
}
