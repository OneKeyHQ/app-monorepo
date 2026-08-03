import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { canUseHeadless } from '@onekeyhq/shared/src/modules3rdParty/onramper';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EModalFiatCryptoRoutes } from '@onekeyhq/shared/src/routes/fiatCrypto';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

export type ITryOpenHeadlessBuyParams = {
  networkId: string;
  tokenAddress: string;
  accountId?: string;
  // Provided when navigating from the token list; direct-buy entries omit it and
  // the token is resolved from the cached list.
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

  // The server (OK-58060) is the single source of truth: `headlessSupported`
  // is region-trimmed by request IP, and `onramperNetworkCode` is the network
  // slug the checkout request needs — a token missing either can never quote,
  // so the caller's web-widget flow runs unchanged for it. A caller-provided
  // token already carries the server fields (same list endpoint), so only
  // token-less direct-buy entries pay the list lookup.
  let resolvedToken = token;
  if (resolvedToken === undefined) {
    resolvedToken =
      await backgroundApiProxy.serviceFiatCrypto.getHeadlessBuyToken({
        networkId,
        tokenAddress,
        accountId,
      });
  }
  if (!resolvedToken?.headlessSupported || !resolvedToken.onramperNetworkCode) {
    return false;
  }

  appGlobals.$navigationRef.current?.navigate(ERootRoutes.Modal, {
    screen: EModalRoutes.FiatCryptoModal,
    params: {
      screen: EModalFiatCryptoRoutes.HeadlessBuy,
      params: { networkId, accountId, tokenAddress, token: resolvedToken },
    },
  });
  return true;
}
