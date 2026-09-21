import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

// Common context every native buy event carries. `elapsedMs` is measured from
// the buy page mount so a checkout timeline can be rebuilt from Mixpanel
// alone (its event timestamps are too coarse to order SDK steps).
export type IOnramperLogContext = {
  networkId: string;
  tokenSymbol: string;
  entryFrom?: string;
  elapsedMs?: number;
};

type IOnramperErrorFields = {
  errorCode?: string;
  // Truncated SDK / backend message. The Nitro bridge folds the backend
  // error code into it (e.g. `quoteUnavailable(debugInfo: "OnramperBackend-40003: …")`).
  errorMessage?: string;
  // Truncated JSON of the SDK's structured `info` payload, when present.
  errorInfo?: string;
};

// Funnel + diagnostics for the native Onramper Headless buy flow. Every event
// is mirrored to the device log so an exported log carries the same timeline
// support sees in Mixpanel. Per-keystroke and per-state-transition events stay
// local-only to keep the server volume bounded.
export class OnramperScene extends BaseScene {
  // ---------------------------------------------------------------------------
  // Entry gate
  // ---------------------------------------------------------------------------

  // Logged once per buy tap on iOS (the only platform where the native path is
  // a candidate) with the routing decision the entry gate took.
  @LogToServer()
  @LogToLocal()
  public entryDecided(params: {
    entryFrom?: string;
    networkId: string;
    tokenAddress: string;
    decision: 'native' | 'web';
    reason:
      | 'ok'
      | 'headlessUnavailable'
      | 'noAccount'
      | 'tokenNotFound'
      | 'headlessNotSupported'
      | 'noNetworkCode';
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public enterAmountPage(params: {
    networkId: string;
    tokenSymbol: string;
    entryFrom?: string;
  }) {
    return params;
  }

  // ---------------------------------------------------------------------------
  // Session + client init
  // ---------------------------------------------------------------------------

  @LogToServer()
  @LogToLocal()
  public sessionMinted(
    params: IOnramperLogContext & {
      durationMs: number;
      // Onramper session identifiers (never the token): the handle Onramper
      // support correlates backend logs by.
      sessionId?: string;
      tokenFamilyId?: string;
      expiresAt?: string;
    },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'error' })
  public sessionMintFailed(
    params: IOnramperLogContext & { durationMs: number; errorMessage?: string },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public clientInitialized(
    params: IOnramperLogContext & { durationMs: number },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'error' })
  public clientInitFailed(
    params: IOnramperLogContext & IOnramperErrorFields & { durationMs: number },
  ) {
    return params;
  }

  // The SDK asked for fresh session credentials mid-flow.
  @LogToServer()
  @LogToLocal()
  public sessionRefreshRequested(params: IOnramperLogContext) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public sessionRefreshed(
    params: IOnramperLogContext & { durationMs: number; sessionId?: string },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'error' })
  public sessionRefreshFailed(
    params: IOnramperLogContext & { durationMs: number; errorMessage?: string },
  ) {
    return params;
  }

  // ---------------------------------------------------------------------------
  // Quote loop
  // ---------------------------------------------------------------------------

  // Fires per debounced amount/provider change — device log only.
  @LogToLocal()
  public quoteRequested(
    params: IOnramperLogContext & {
      seq: number;
      amount: number;
      source: string;
      destination: string;
      provider?: string;
    },
  ) {
    return params;
  }

  // The quote effect could not run because the payout address has not
  // resolved yet (the page holds "Preparing" until it does).
  @LogToLocal()
  public quoteBlockedNoAddress(
    params: IOnramperLogContext & { amount: number },
  ) {
    return params;
  }

  // Every successful quote — device log only (per keystroke).
  @LogToLocal()
  public quoteResolved(
    params: IOnramperLogContext & {
      seq: number;
      durationMs: number;
      amount: number;
      quoteId?: string;
      ramp?: string;
      payout?: number;
      networkFee?: number;
      transactionFee?: number;
      recommendations?: string[];
    },
  ) {
    return params;
  }

  // First successful quote of the page only (server funnel step).
  @LogToServer()
  public quoteReceived(
    params: IOnramperLogContext & {
      amount: number;
      durationMs: number;
      // Onramper quote id — pairs with checkoutId for server-side order tracing.
      quoteId?: string;
      ramp?: string;
      payout?: number;
      networkFee?: number;
      transactionFee?: number;
    },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'error' })
  public quoteFailed(
    params: IOnramperLogContext &
      IOnramperErrorFields & {
        seq: number;
        durationMs: number;
        amount: number;
        provider?: string;
      },
  ) {
    return params;
  }

  // A quote response arrived after a newer request superseded it.
  @LogToLocal()
  public quoteStale(
    params: IOnramperLogContext & {
      seq: number;
      outcome: 'success' | 'failure';
    },
  ) {
    return params;
  }

  // ---------------------------------------------------------------------------
  // SDK checkout lifecycle
  // ---------------------------------------------------------------------------

  // Raw SDK state machine transitions — device log only (duplicates the
  // checkout events below, but is the ground truth when they diverge).
  @LogToLocal()
  public sdkStateChanged(
    params: IOnramperLogContext & {
      state: string;
      requirementTypes?: string[];
      renderType?: string;
      paymentType?: string;
      errorCode?: string;
      errorMessage?: string;
    },
  ) {
    return params;
  }

  // Every SDK checkout event other than `completed` / `failed` (those have
  // dedicated events below). One checkout emits roughly ten of these.
  @LogToServer()
  @LogToLocal()
  public sdkCheckoutEvent(
    params: IOnramperLogContext & {
      event: string;
      intentId?: string;
      requirementTypes?: string[];
      requirementType?: string;
      headlessCheckoutId?: string;
      transactionId?: string;
      renderType?: string;
      paymentType?: string;
      // Host of the provider checkout URL only (never the full URL: it can
      // carry session-bound query parameters).
      urlHost?: string;
      reason?: string;
    },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public checkoutCompleted(
    params: IOnramperLogContext & {
      amount?: number;
      ramp?: string;
      // Onramper checkout id — per-attempt handle for locating this order
      // with Onramper support (device logs don't persist).
      checkoutId?: string;
      // Durable Onramper transaction id — the key for GET /transactions/{id}
      // order-status lookups on the backend.
      transactionId?: string;
    },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'error' })
  public checkoutFailed(
    params: IOnramperLogContext &
      IOnramperErrorFields & {
        amount?: number;
        ramp?: string;
        // Present only when the SDK attaches it (post-checkout failures).
        checkoutId?: string;
        // Present once checkout finalize succeeded (see checkoutCompleted).
        transactionId?: string;
      },
  ) {
    return params;
  }

  // ---------------------------------------------------------------------------
  // Page interactions
  // ---------------------------------------------------------------------------

  @LogToServer()
  @LogToLocal()
  public reviewEntered(
    params: IOnramperLogContext & { amount: number; via: 'preset' | 'preview' },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public reviewExited(
    params: IOnramperLogContext & { amount: number; actionState: string },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public providerSelected(
    params: IOnramperLogContext & { from?: string; to?: string },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public retryPressed(params: IOnramperLogContext & { errorCode?: string }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public webFallbackShown(params: IOnramperLogContext & IOnramperErrorFields) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public webFallbackPressed(
    params: IOnramperLogContext & { errorCode?: string; hasUrl: boolean },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public signOutPressed(params: IOnramperLogContext) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'error' })
  public signOutFailed(
    params: IOnramperLogContext & { errorMessage?: string },
  ) {
    return params;
  }

  // reset() is what returns a failed SDK state machine to `ready`; a failure
  // here means the in-place Retry is degraded.
  @LogToServer()
  @LogToLocal({ level: 'error' })
  public resetFailed(params: IOnramperLogContext & { errorMessage?: string }) {
    return params;
  }

  @LogToLocal({ level: 'error' })
  public clientDestroyFailed(
    params: IOnramperLogContext & { errorMessage?: string },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public orderIdCopied(params: {
    networkId: string;
    tokenSymbol: string;
    transactionId: string;
  }) {
    return params;
  }
}
