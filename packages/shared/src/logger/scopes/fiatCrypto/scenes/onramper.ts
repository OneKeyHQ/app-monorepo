import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

// Funnel events for the native Onramper Headless buy flow.
export class OnramperScene extends BaseScene {
  @LogToServer()
  public enterAmountPage(params: { networkId: string; tokenSymbol: string }) {
    return params;
  }

  @LogToServer()
  public quoteReceived(params: {
    networkId: string;
    tokenSymbol: string;
    amount: number;
    // Onramper quote id — pairs with checkoutId for server-side order tracing.
    quoteId?: string;
  }) {
    return params;
  }

  @LogToServer()
  public checkoutCompleted(params: {
    networkId: string;
    tokenSymbol: string;
    // Onramper checkout id — the server-side handle for locating this order
    // with Onramper support (device logs don't persist).
    checkoutId?: string;
  }) {
    return params;
  }

  @LogToServer()
  public checkoutFailed(params: {
    networkId: string;
    tokenSymbol: string;
    errorCode?: string;
    // Present only when the SDK attaches it (post-checkout failures);
    // quote-stage failures have no checkout yet.
    checkoutId?: string;
  }) {
    return params;
  }

  @LogToServer()
  public webFallbackShown(params: {
    networkId: string;
    tokenSymbol: string;
    errorCode?: string;
  }) {
    return params;
  }
}
