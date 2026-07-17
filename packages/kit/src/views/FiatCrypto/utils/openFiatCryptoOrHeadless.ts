import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { canUseHeadless } from '@onekeyhq/shared/src/modules3rdParty/onramper';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EModalFiatCryptoRoutes } from '@onekeyhq/shared/src/routes/fiatCrypto';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

import { toOnramperNetworkCode } from './onramperCodes';

// TEMPORARY(onramper-demo): the backend `headlessSupported` flags (OK-58060)
// haven't shipped, so production entries can't route headless yet. Dev builds
// treat the staging-tested native coins as supported so the flow can be
// demoed from the REAL entries (Home → 買入 → pick a token) instead of the
// Gallery. Remove when the backend flag lands. Keys are OneKey network ids;
// values are lowercase token addresses ('' = the chain's native coin).
const DEV_HEADLESS_ALLOWLIST: Record<string, Set<string>> = {
  'evm--1': new Set(['']),
  'btc--0': new Set(['']),
  'sol--101': new Set(['']),
};

export type ITryOpenHeadlessBuyParams = {
  networkId: string;
  tokenAddress: string;
  accountId?: string;
  // Provided when navigating from the token list; direct-buy entries omit it and
  // the flag is resolved from the cached list.
  token?: IFiatCryptoToken;
};

// The single choke point for every buy entry. Returns true if it navigated to
// the native Headless buy page (the caller must stop); returns false when the
// native path isn't available, so the caller runs its existing web-widget flow
// unchanged. Buy-only — sell always stays on the web widget.
//
// Spliced in ahead of `generateWidgetUrl` at every buy entry — keep this list
// in sync when adding an 8th: ActionBuy's openFiatCryptoWidget (also serves
// the aggregate Overview tab), SellOrBuy list, WalletActionBuy,
// WalletActions/index, Market tradeHook, Send SendAmountInputContainer,
// ReceiveSelector.
export async function tryOpenHeadlessBuy({
  networkId,
  tokenAddress,
  accountId,
  token,
}: ITryOpenHeadlessBuyParams): Promise<boolean> {
  if (!canUseHeadless()) {
    return false;
  }

  // The headless page must translate the OneKey network id into an Onramper
  // slug; a network outside that map can never quote, so refuse BEFORE any
  // network I/O — this also keeps the web-fallback tap latency unchanged for
  // every unmapped network.
  if (toOnramperNetworkCode(networkId) === undefined) {
    return false;
  }

  let headlessSupported = Boolean(token?.headlessSupported);
  if (!headlessSupported && token === undefined) {
    headlessSupported =
      await backgroundApiProxy.serviceFiatCrypto.isHeadlessSupported({
        networkId,
        tokenAddress,
        accountId,
      });
  }
  if (!headlessSupported && platformEnv.isDev) {
    headlessSupported =
      DEV_HEADLESS_ALLOWLIST[networkId]?.has(tokenAddress.toLowerCase()) ??
      false;
  }
  if (!headlessSupported) {
    return false;
  }

  appGlobals.$navigationRef.current?.navigate(ERootRoutes.Modal, {
    screen: EModalRoutes.FiatCryptoModal,
    params: {
      screen: EModalFiatCryptoRoutes.HeadlessBuy,
      params: { networkId, accountId, tokenAddress, token },
    },
  });
  return true;
}
