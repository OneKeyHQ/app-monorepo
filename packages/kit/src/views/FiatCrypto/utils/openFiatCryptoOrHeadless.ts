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
  // the flag is resolved from the cached list.
  token?: IFiatCryptoToken;
};

// The single choke point for every buy entry. Returns true if it navigated to
// the native Headless buy page (the caller must stop); returns false when the
// native path isn't available, so the caller runs its existing web-widget flow
// unchanged. Buy-only — sell always stays on the web widget.
export async function tryOpenHeadlessBuy({
  networkId,
  tokenAddress,
  accountId,
  token,
}: ITryOpenHeadlessBuyParams): Promise<boolean> {
  if (!canUseHeadless()) {
    return false;
  }

  let headlessSupported = Boolean(token?.headlessSupported);
  if (token === undefined) {
    headlessSupported =
      await backgroundApiProxy.serviceFiatCrypto.isHeadlessSupported({
        networkId,
        tokenAddress,
        accountId,
      });
  }
  if (!headlessSupported) {
    return false;
  }

  appGlobals.$navigationRef.current?.navigate(ERootRoutes.Modal, {
    screen: EModalRoutes.FiatCryptoModal,
    params: {
      screen: EModalFiatCryptoRoutes.HeadlessBuy,
      params: { networkId, accountId, tokenAddress, type: 'buy', token },
    },
  });
  return true;
}
