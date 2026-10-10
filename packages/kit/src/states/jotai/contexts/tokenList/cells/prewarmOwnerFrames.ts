import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  getOwnerWorth,
  rememberOwnerWorth,
} from '@onekeyhq/kit/src/views/Home/components/TokenListBlock/ownerWorthCache';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import {
  getOwnerReplayFrames,
  rememberOwnerReplayFrame,
} from './ownerFrameReplayCache';

export interface IPrewarmHomeTokenListOwnerParams {
  networkId: string | undefined;
  deriveType: IAccountDeriveTypes | undefined;
  indexedAccountId?: string;
  othersWalletAccountId?: string;
  /**
   * The settings currency the caller will replay in. Remembered frames in
   * another currency are useless to the replay (it rejects them), so they do
   * not count as "already warm" and the owner is rebuilt from the background.
   */
  currencyId?: string;
}

const HOME_STORE_NAME = EJotaiContextStoreNames.homeTokenList;

const inFlight = new Map<
  string,
  { run: Promise<boolean>; seqRef: { current: number } }
>();

// Owner keys resolved by earlier prewarms (the selector prewarms its listed
// rows while open). A tap on one of those rows then confirms from the replay
// cache without another background round trip. Only a hint: an entry
// short-circuits while the replay cache still holds frames for that owner,
// which is cleared with it on wallet / account removal.
const RESOLVED_OWNER_KEYS_CAP = 64;
const resolvedOwnerKeys = new Map<string, string>();

function rememberResolvedOwnerKey(key: string, ownerKey: string): void {
  resolvedOwnerKeys.delete(key);
  resolvedOwnerKeys.set(key, ownerKey);
  while (resolvedOwnerKeys.size > RESOLVED_OWNER_KEYS_CAP) {
    const oldest = resolvedOwnerKeys.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    resolvedOwnerKeys.delete(oldest);
  }
}

// Intent order of prewarm requests, and the latest request that wrote each
// owner's frames. The background answers in its settings currency at the time
// it runs, so across a currency switch a request dispatched earlier can land
// after a later one; it must not replace the later request's frames with the
// old currency's (the replay would then reject them or paint stale fiat).
// A caller joining an in-flight request is a newer intent than its dispatch
// (e.g. switching the currency away and back), so it takes a new seq too; so
// does a caller served from the replay cache, whose frames an older request
// still in flight must then not replace.
let prewarmDispatchSeq = 0;
const ownerWriteSeqMap = new Map<string, number>();

function claimOwnerWrite(ownerKey: string, seq: number): boolean {
  const written = ownerWriteSeqMap.get(ownerKey);
  if (written !== undefined && written > seq) {
    return false;
  }
  ownerWriteSeqMap.delete(ownerKey);
  ownerWriteSeqMap.set(ownerKey, seq);
  while (ownerWriteSeqMap.size > RESOLVED_OWNER_KEYS_CAP) {
    const oldest = ownerWriteSeqMap.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    ownerWriteSeqMap.delete(oldest);
  }
  return true;
}

// Frames the replay would accept: a structure frame, remembered in the
// currency the caller replays in (when it names one).
function hasFramesForReplay({
  ownerKey,
  currencyId,
}: {
  ownerKey: string;
  currencyId: string | undefined;
}): boolean {
  const frames = getOwnerReplayFrames({
    storeName: HOME_STORE_NAME,
    ownerKey,
  });
  if (!frames?.structure) {
    return false;
  }
  return !currencyId || frames.currencyId === currencyId;
}

function paramsKey(params: IPrewarmHomeTokenListOwnerParams): string {
  return [
    params.networkId ?? '',
    params.deriveType ?? '',
    params.indexedAccountId ?? '',
    params.othersWalletAccountId ?? '',
  ].join('\u0000');
}

/**
 * Put an owner's local-cache frames into the main-heap replay cache before
 * the account selector publishes it (OK-63873), so the home page paints the
 * switch synchronously instead of showing a skeleton while the post-publish
 * seed round runs. The background builds the frames from the same local
 * cache the seed reads; a resident owner costs one round trip and no ingest.
 * Resolves true when the owner now has frames to replay. Never throws.
 */
export async function prewarmHomeTokenListOwner(
  params: IPrewarmHomeTokenListOwnerParams,
): Promise<boolean> {
  if (
    !params.networkId ||
    // All Networks (and its merge) is owned by the UI; the background has
    // nothing to prewarm there, so no round trip for any caller.
    networkUtils.isAllNetwork({ networkId: params.networkId })
  ) {
    return false;
  }
  const key = paramsKey(params);
  const knownOwnerKey = resolvedOwnerKeys.get(key);
  if (
    knownOwnerKey &&
    hasFramesForReplay({
      ownerKey: knownOwnerKey,
      currencyId: params.currencyId,
    })
  ) {
    prewarmDispatchSeq += 1;
    claimOwnerWrite(knownOwnerKey, prewarmDispatchSeq);
    return true;
  }
  // A currency switch mid-prewarm must not join the old currency's request:
  // its frames would be rejected by the replay in the new currency.
  const inFlightKey = `${key}\u0000${params.currencyId ?? ''}`;
  prewarmDispatchSeq += 1;
  const pending = inFlight.get(inFlightKey);
  if (pending) {
    pending.seqRef.current = prewarmDispatchSeq;
    return pending.run;
  }
  const seqRef = { current: prewarmDispatchSeq };
  const run = (async () => {
    try {
      const result =
        await backgroundApiProxy.serviceTokenViewModel.prewarmHomeTokenListFrames(
          params,
        );
      if (!result?.frames.structure || !result.currency) {
        return false;
      }
      const { ownerKey, frames, currency, worth } = result;
      const { structure } = frames;
      if (!structure) {
        return false;
      }
      rememberResolvedOwnerKey(key, ownerKey);
      // The header worth for the switch frame; the same shape the
      // single-network cache seed writes after the publish.
      if (worth && params.networkId && !getOwnerWorth(ownerKey)) {
        rememberOwnerWorth(ownerKey, {
          worth: {
            [accountUtils.buildAccountValueKey({
              accountId: worth.accountId,
              networkId: params.networkId,
            })]: worth.value,
          },
          createAtNetworkWorth: worth.value,
          currency: worth.currency,
        });
      }
      // The background answers in its own settings currency; frames in any
      // other currency than the caller replays in are not a warm owner.
      const inReplayCurrency =
        !params.currencyId || currency === params.currencyId;
      const storeName = HOME_STORE_NAME;
      if (hasFramesForReplay({ ownerKey, currencyId: currency })) {
        return inReplayCurrency;
      }
      if (!claimOwnerWrite(ownerKey, seqRef.current)) {
        // A later prewarm already wrote this owner (in another currency).
        return false;
      }
      rememberOwnerReplayFrame({
        storeName,
        ownerKey,
        kind: 'structure',
        payload: {
          ownerKey,
          structureVersion: frames.structureVersion,
          structure,
        },
        currencyId: currency,
      });
      if (frames.valuation) {
        rememberOwnerReplayFrame({
          storeName,
          ownerKey,
          kind: 'valuation',
          payload: {
            ownerKey,
            valuationVersion: frames.valuationVersion,
            valuation: frames.valuation,
          },
          currencyId: currency,
        });
      }
      if (frames.riskyVersion >= 0) {
        rememberOwnerReplayFrame({
          storeName,
          ownerKey,
          kind: 'risky',
          payload: {
            ownerKey,
            riskyVersion: frames.riskyVersion,
            riskyTokens: frames.riskyTokens,
            riskyMap: frames.riskyMap,
          },
          currencyId: currency,
        });
      }
      return inReplayCurrency;
    } catch {
      return false;
    } finally {
      inFlight.delete(inFlightKey);
    }
  })();
  inFlight.set(inFlightKey, { run, seqRef });
  return run;
}

/**
 * The tap-time variant: wait for the prewarm only up to `timeoutMs` so the
 * selection never stalls on it (the prewarm keeps running and is still useful
 * if it lands before the home page paints the new owner).
 */
export function prewarmHomeTokenListOwnerWithin(
  params: IPrewarmHomeTokenListOwnerParams,
  timeoutMs: number,
): Promise<boolean> {
  return Promise.race([
    prewarmHomeTokenListOwner(params),
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
}

/** How long a selector tap waits for the target owner's prewarm. */
export const HOME_TOKEN_LIST_PREWARM_TAP_TIMEOUT_MS = 250;

/**
 * The owner a home account-selector row switches to, as prewarm params. The
 * open-time prewarm and the tap share it so both warm the owner the tap
 * publishes. Others-wallet rows are DB accounts, not indexed accounts, and
 * land on the row's matched network unless All Networks is selected (the
 * same choice `confirmAccountSelect` gets).
 */
export function buildAccountSelectorRowPrewarmParams({
  row,
  isOthersUniversal,
  selectedNetworkId,
  selectedDeriveType,
  currencyId,
}: {
  row: {
    account?: { id: string };
    indexedAccount?: { id: string };
    avatarNetworkId?: string;
  };
  isOthersUniversal: boolean;
  selectedNetworkId: string | undefined;
  selectedDeriveType: IAccountDeriveTypes | undefined;
  currencyId: string | undefined;
}): IPrewarmHomeTokenListOwnerParams {
  if (isOthersUniversal) {
    const networkId =
      selectedNetworkId &&
      networkUtils.isAllNetwork({ networkId: selectedNetworkId })
        ? selectedNetworkId
        : (row.avatarNetworkId ?? selectedNetworkId);
    return {
      networkId,
      deriveType: selectedDeriveType,
      othersWalletAccountId: row.account?.id,
      currencyId,
    };
  }
  return {
    networkId: selectedNetworkId,
    deriveType: selectedDeriveType,
    indexedAccountId: row.indexedAccount?.id,
    currencyId,
  };
}
