import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { canUseHeadless } from '@onekeyhq/shared/src/modules3rdParty/onramper';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EModalFiatCryptoRoutes } from '@onekeyhq/shared/src/routes/fiatCrypto';
import type {
  EHeadlessBuyEntry,
  IFiatCryptoToken,
} from '@onekeyhq/shared/types/fiatCrypto';

export type ITryOpenHeadlessBuyParams = {
  networkId: string;
  tokenAddress: string;
  accountId?: string;
  // Provided when navigating from the token list; direct-buy entries omit it and
  // the token is resolved from the cached list.
  token?: IFiatCryptoToken;
  // Launching surface — analytics only.
  entryFrom: EHeadlessBuyEntry;
};

type IEntryDecisionReason = Parameters<
  typeof defaultLogger.fiatCrypto.onramper.entryDecided
>[0]['reason'];

// The native path is only ever a candidate on iOS; logging the gate on every
// other platform's buy tap would be pure noise.
function logEntryDecision(
  params: ITryOpenHeadlessBuyParams,
  reason: IEntryDecisionReason,
) {
  if (!platformEnv.isNativeIOS) {
    return;
  }
  defaultLogger.fiatCrypto.onramper.entryDecided({
    entryFrom: params.entryFrom,
    networkId: params.networkId,
    tokenAddress: params.tokenAddress,
    decision: reason === 'ok' ? 'native' : 'web',
    reason,
  });
}

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
export async function tryOpenHeadlessBuy(
  params: ITryOpenHeadlessBuyParams,
): Promise<boolean> {
  const { networkId, tokenAddress, accountId, token, entryFrom } = params;
  if (!canUseHeadless()) {
    logEntryDecision(params, 'headlessUnavailable');
    return false;
  }

  // The native flow pays out to the account's own address — without an
  // account there is no destination to quote against (several entries pass
  // '' when none is active). The web widget collects an address itself, so
  // it keeps handling that case.
  if (!accountId) {
    logEntryDecision(params, 'noAccount');
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
    try {
      resolvedToken =
        await backgroundApiProxy.serviceFiatCrypto.getHeadlessBuyToken({
          networkId,
          tokenAddress,
          accountId,
        });
    } catch {
      // The lookup only decides native vs web; a transient list failure must
      // not reject the buy tap — the caller's web-widget flow still runs.
      logEntryDecision(params, 'tokenLookupFailed');
      return false;
    }
  }
  if (!resolvedToken) {
    logEntryDecision(params, 'tokenNotFound');
    return false;
  }
  if (!resolvedToken.headlessSupported) {
    logEntryDecision(params, 'headlessNotSupported');
    return false;
  }
  if (!resolvedToken.onramperNetworkCode) {
    logEntryDecision(params, 'noNetworkCode');
    return false;
  }

  logEntryDecision(params, 'ok');
  appGlobals.$navigationRef.current?.navigate(ERootRoutes.Modal, {
    screen: EModalRoutes.FiatCryptoModal,
    params: {
      screen: EModalFiatCryptoRoutes.HeadlessBuy,
      params: {
        networkId,
        accountId,
        tokenAddress,
        token: resolvedToken,
        entryFrom,
      },
    },
  });
  return true;
}
