export enum ESwapQuoteReadinessBlocker {
  NetworkSelector = 'network-selector',
  InitialTokenSync = 'initial-token-sync',
  AccountStorageInit = 'account-storage-init',
  ActiveAccountInit = 'active-account-init',
  FromAddressResolution = 'from-address-resolution',
  ToAddressResolution = 'to-address-resolution',
}

export type ISwapQuoteReadiness =
  | {
      ready: true;
      blocker: undefined;
    }
  | {
      ready: false;
      blocker: ESwapQuoteReadinessBlocker;
    };

export function getSwapQuoteReadiness({
  accountSelectorActiveAccountInitDone,
  accountSelectorStorageInitDone,
  fromAddressInfoReady,
  initialSelectedTokensSynced,
  networkSelectorReady,
  toAddressInfoReady,
}: {
  networkSelectorReady: boolean;
  initialSelectedTokensSynced: boolean;
  accountSelectorStorageInitDone: boolean;
  accountSelectorActiveAccountInitDone: boolean;
  fromAddressInfoReady: boolean;
  toAddressInfoReady: boolean;
}): ISwapQuoteReadiness {
  const blocker = [
    !networkSelectorReady
      ? ESwapQuoteReadinessBlocker.NetworkSelector
      : undefined,
    !initialSelectedTokensSynced
      ? ESwapQuoteReadinessBlocker.InitialTokenSync
      : undefined,
    !accountSelectorStorageInitDone
      ? ESwapQuoteReadinessBlocker.AccountStorageInit
      : undefined,
    !accountSelectorActiveAccountInitDone
      ? ESwapQuoteReadinessBlocker.ActiveAccountInit
      : undefined,
    !fromAddressInfoReady
      ? ESwapQuoteReadinessBlocker.FromAddressResolution
      : undefined,
    !toAddressInfoReady
      ? ESwapQuoteReadinessBlocker.ToAddressResolution
      : undefined,
  ].find((item): item is ESwapQuoteReadinessBlocker => Boolean(item));

  if (blocker) {
    return {
      ready: false,
      blocker,
    };
  }

  // Address resolution may validly complete without an address when no wallet
  // is connected. Callers must gate on readiness, not address presence.
  return {
    ready: true,
    blocker: undefined,
  };
}
