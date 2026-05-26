import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ISwapAlertState,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

export function isUSMarketStatusStockTokenSource(source?: string) {
  return equalsIgnoreCase(source, 'coingecko');
}

export function shouldCheckSwapWarningUSMarketClosed({
  alerts,
  swapTypeSwitch,
  fromToken,
  toToken,
  accountReady,
  isWaitingActionableQuote,
  hasFromAccountWallet,
}: {
  alerts: ISwapAlertState[];
  swapTypeSwitch: ESwapTabSwitchType;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  accountReady?: boolean;
  isWaitingActionableQuote: boolean;
  hasFromAccountWallet: boolean;
}) {
  return (
    !alerts.length &&
    swapTypeSwitch === ESwapTabSwitchType.SWAP &&
    Boolean(fromToken && toToken) &&
    accountReady === true &&
    !isWaitingActionableQuote &&
    hasFromAccountWallet
  );
}
