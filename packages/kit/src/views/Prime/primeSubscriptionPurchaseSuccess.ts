import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export type IPrimeSubscriptionPurchaseSuccessPayload =
  IAppEventBusPayload[EAppEventBusNames.PrimeSubscriptionPurchaseSuccess];

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function preparePrimeSubscriptionPurchaseSuccess(
  onekeyUserId: string,
): Promise<IPrimeSubscriptionPurchaseSuccessPayload> {
  try {
    const claim = await backgroundApiProxy.serviceSetting.tryClaimKytIntro({
      onekeyUserId,
      ownerId: appEventBus.nodeId,
      entryPoint: 'primeSubscribeSuccess',
    });
    return {
      onekeyUserId,
      claimId: claim.status === 'claimed' ? claim.claimId : undefined,
    };
  } catch (error) {
    defaultLogger.prime.usage.primeReceiveKytIntroFlowFailed({
      stage: 'purchaseClaim',
      errorMessage: getErrorMessage(error),
    });
    return { onekeyUserId };
  }
}

export function emitPrimeSubscriptionPurchaseSuccess(
  payload: IPrimeSubscriptionPurchaseSuccessPayload,
) {
  appEventBus.emitToSelf({
    type: EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
    payload,
    isRemote: false,
  });
}

export async function refreshPrimeUserInfoAfterPurchase() {
  try {
    await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
  } catch (error) {
    // RevenueCat is authoritative for purchase completion; the server
    // projection may lag behind its webhook and can be refreshed later.
    defaultLogger.prime.usage.primeReceiveKytIntroFlowFailed({
      stage: 'primeUserRefresh',
      errorMessage: getErrorMessage(error),
    });
  }
}

// Canonical post-purchase tail for surfaces without a native success dialog:
// the server projection refresh always runs; the UI-local success event fires
// only for a confirmed purchase. The claim reservation (prepare) must already
// have completed before this runs, so other surfaces woken by the refresh see
// the purchase-priority lease first.
export async function finishPrimeSubscriptionPurchaseSuccess(
  payload: IPrimeSubscriptionPurchaseSuccessPayload | undefined,
) {
  await refreshPrimeUserInfoAfterPurchase();
  if (payload) {
    emitPrimeSubscriptionPurchaseSuccess(payload);
  }
}

// Handles the web-embed `closeWebViewModalAfterPrimePurchaseSuccess` request
// on behalf of the generic WebView modal, keeping the Prime-specific trust
// checks and lease choreography out of that shared component.
export function handlePrimePurchaseSuccessCloseRequest({
  params,
  hashRoutePath,
  routePrimeUserId,
  isWebEmbed,
  pop,
}: {
  params: unknown;
  hashRoutePath: string | undefined;
  routePrimeUserId: unknown;
  isWebEmbed: boolean | undefined;
  pop: () => void;
}) {
  const requestUserId = (params as { onekeyUserId?: unknown } | undefined)
    ?.onekeyUserId;
  const onekeyUserId = typeof requestUserId === 'string' ? requestUserId : '';
  const purchaseUserId =
    typeof routePrimeUserId === 'string' ? routePrimeUserId : '';
  if (
    !isWebEmbed ||
    hashRoutePath !== EWebEmbedRoutePath.primePurchase ||
    !onekeyUserId ||
    onekeyUserId !== purchaseUserId
  ) {
    pop();
    return;
  }
  // Dispatch the BG reservation before popping the WebView. A Home runtime may
  // react to the route change synchronously, but it must see the
  // purchase-priority lease first.
  const preparePayloadPromise =
    preparePrimeSubscriptionPurchaseSuccess(onekeyUserId);
  pop();
  void (async () => {
    const payload = await preparePayloadPromise;
    // Navigation state drops the modal route the moment pop() dispatches, so
    // route checks cannot see the close animation. Hold the success event
    // until the animation has finished to keep the KYT intro from mounting
    // over the unmounting WebView modal (relevant when claim/refresh settle
    // instantly, e.g. an immediate refresh failure).
    await timerUtils.wait(350);
    await finishPrimeSubscriptionPurchaseSuccess(payload);
  })();
}
