import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid';

type IShouldCheckPerpsAccountStatusOnFocusParams = {
  isFocused: boolean;
  hasSelectedAccountParams: boolean;
  isSelectingAccount: boolean;
  lastCheckTimeMs: number;
  nowMs: number;
  staleMs: number;
};

type IInitialTradeAsset = {
  coin: string;
};

type IInitialSpotTradeAsset = IInitialTradeAsset & {
  universe?: ISpotUniverse;
};

type IInitialTradeInstrument =
  | { mode: 'perp'; coin: string }
  | { mode: 'spot'; coin: string; universe?: ISpotUniverse };

// Only the claiming run may act on a deeplink intent. A mounted page has
// already switched through the event bus, so re-applying it on a later resync
// drags the user off a market they picked after the notification, for the
// whole intent lifetime. Extracted so that dropping the gate fails a test
// rather than silently reviving that.
export function resolveAppliedDeeplinkIntent<T>({
  claimed,
  deeplinkIntent,
}: {
  claimed: boolean;
  deeplinkIntent: T | undefined;
}): T | undefined {
  return claimed ? deeplinkIntent : undefined;
}

export function buildInitialTradeInstrumentSwitchParams({
  mode,
  perpAsset,
  spotAsset,
  force,
  allowPerpFallback,
  preferredInstrument,
  deeplinkIntent,
}: {
  mode: 'perp' | 'spot';
  perpAsset?: IInitialTradeAsset;
  spotAsset?: IInitialSpotTradeAsset;
  force?: boolean;
  allowPerpFallback?: boolean;
  preferredInstrument?: IInitialTradeInstrument;
  deeplinkIntent?: IInitialTradeInstrument;
}) {
  // A deeplink target outranks the restore: the restored snapshot was persisted
  // before the tap, so the "never staler" reasoning below does not cover it —
  // replaying it reopens the market the user just navigated away from.
  const explicitInstrument = deeplinkIntent?.coin
    ? deeplinkIntent
    : preferredInstrument;
  // preferredInstrument is written synchronously when a switch starts, while
  // the mode and asset atoms are written near the end and can be skipped by a
  // superseding request. It is therefore never the staler record, and it is
  // also what the first frame already rendered — restoring anything else shows
  // the user a pair flip.
  if (explicitInstrument?.coin) {
    if (explicitInstrument.mode === 'spot') {
      return {
        mode: 'spot' as const,
        coin: explicitInstrument.coin,
        spotUniverse: explicitInstrument.universe,
        force,
      };
    }
    return {
      mode: 'perp' as const,
      coin: explicitInstrument.coin,
      force,
    };
  }

  if (mode === 'spot') {
    if (spotAsset?.coin) {
      return {
        mode: 'spot' as const,
        coin: spotAsset.coin,
        spotUniverse: spotAsset.universe,
        force,
      };
    }

    // changeActiveSpotAsset persists the mode before the asset, so a restart
    // can restore spot with no coin. Only the cold-start caller opts in —
    // for resync callers the fallback would abort an in-flight spot switch.
    if (!allowPerpFallback) {
      return undefined;
    }
  }

  if (!perpAsset?.coin) {
    return undefined;
  }
  return {
    mode: 'perp' as const,
    coin: perpAsset.coin,
    force,
  };
}

export function shouldCheckPerpsAccountStatusOnFocus({
  isFocused,
  hasSelectedAccountParams,
  isSelectingAccount,
  lastCheckTimeMs,
  nowMs,
  staleMs,
}: IShouldCheckPerpsAccountStatusOnFocusParams) {
  if (!isFocused || !hasSelectedAccountParams || isSelectingAccount) {
    return false;
  }
  return lastCheckTimeMs + staleMs < nowMs;
}

type IShouldRunPerpsAccountSelectParams = {
  lastParams: string | null;
  currentParams: string;
  isExternalAccount: boolean;
  lastAddress: string | null;
  currentAddress: string | null;
};

// Decides whether selectPerpsAccount should run past its dedup gate.
//
// The id-based `params` key (indexedAccountId/accountId/walletId/deriveType/
// refreshHook) deliberately excludes the account address: for HD/indexed
// accounts the EVM address resolves asynchronously AFTER the id (undefined ->
// defined), so keying on it would re-fire the rebind + network status check on
// every account mount.
//
// The core extra signal is a "defined -> different defined" address transition
// while the id-based key is unchanged: that only happens when an account's EVM
// address mutates IN PLACE under a stable account row. The one account class
// that does this today is an external/connected dApp wallet in web-dapp mode —
// switching the connected account on the extension rewrites the same row's
// address while the id stays constant (OK-56744), so the id-based key never
// changes and the rebind is skipped, leaving perpsActiveAccountAtom on the old
// address and the Perps asset panel stale. We gate on isExternalAccount so the
// bypass is scoped to that known case and an undefined->defined mount (HD) is
// never mistaken for an in-place switch.
//
// So: always run when the id-based key changes; additionally force a run only
// for an external account whose address transitions between two distinct
// DEFINED values.
export function shouldRunPerpsAccountSelect({
  lastParams,
  currentParams,
  isExternalAccount,
  lastAddress,
  currentAddress,
}: IShouldRunPerpsAccountSelectParams): boolean {
  if (lastParams !== currentParams) {
    return true;
  }
  return (
    isExternalAccount &&
    !!lastAddress &&
    !!currentAddress &&
    lastAddress !== currentAddress
  );
}
