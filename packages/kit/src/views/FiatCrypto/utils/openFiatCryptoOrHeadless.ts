import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { canUseHeadless } from '@onekeyhq/shared/src/modules3rdParty/onramper/canUseHeadless';
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
  // When the list that `token` came from was fetched from the server
  // (IFiatCryptoTokenListWithNetworks.fetchedAt). The row decides native vs
  // web only while this is recent, see HEADLESS_BUY_ROW_MAX_AGE_MS.
  tokenFetchedAt?: number;
  // Launching surface — analytics only.
  entryFrom: EHeadlessBuyEntry;
};

type IEntryDecision = Parameters<
  typeof defaultLogger.fiatCrypto.onramper.entryDecided
>[0];
type IEntryDecisionReason = IEntryDecision['reason'];
type IEntryTokenSource = IEntryDecision['tokenSource'];

// `headlessSupported` is trimmed by the IP of the request that fetched the
// list, and a list row can be much older than it looks: the buy list paints a
// persisted snapshot before its own fetch lands, and a list left open is not
// fetched again. Past this age (or with no fetch time at all) the row no longer
// decides, and the tap asks the server like a direct-buy entry does.
const HEADLESS_BUY_ROW_MAX_AGE_MS = 60_000;

function isRecentRow(tokenFetchedAt: number | undefined): boolean {
  if (tokenFetchedAt === undefined) {
    return false;
  }
  const ageMs = Date.now() - tokenFetchedAt;
  return ageMs >= 0 && ageMs <= HEADLESS_BUY_ROW_MAX_AGE_MS;
}

// The native path is only ever a candidate on iOS; logging the gate on every
// other platform's buy tap would be pure noise.
function logEntryDecision(
  params: ITryOpenHeadlessBuyParams,
  reason: IEntryDecisionReason,
  tokenSource?: IEntryTokenSource,
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
    tokenSource,
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
  const {
    networkId,
    tokenAddress,
    accountId,
    token,
    tokenFetchedAt,
    entryFrom,
  } = params;
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
  // token carries the server fields (same list endpoint) and skips the list
  // lookup while its list is recent; token-less direct-buy entries and older
  // rows pay it.
  let resolvedToken = token;
  let tokenSource: IEntryTokenSource = 'row';
  if (resolvedToken === undefined || !isRecentRow(tokenFetchedAt)) {
    try {
      resolvedToken =
        await backgroundApiProxy.serviceFiatCrypto.getHeadlessBuyToken({
          networkId,
          tokenAddress,
          accountId,
        });
      tokenSource = 'lookup';
    } catch {
      if (resolvedToken === undefined) {
        // The lookup only decides native vs web; a transient list failure
        // must not reject the buy tap — the caller's web-widget flow still
        // runs.
        logEntryDecision(params, 'tokenLookupFailed');
        return false;
      }
      // The server cannot be asked: the row is the best answer there is.
      tokenSource = 'staleRow';
    }
  }
  if (!resolvedToken) {
    logEntryDecision(params, 'tokenNotFound', tokenSource);
    return false;
  }
  if (!resolvedToken.headlessSupported) {
    logEntryDecision(params, 'headlessNotSupported', tokenSource);
    return false;
  }
  if (!resolvedToken.onramperNetworkCode) {
    logEntryDecision(params, 'noNetworkCode', tokenSource);
    return false;
  }

  logEntryDecision(params, 'ok', tokenSource);
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
