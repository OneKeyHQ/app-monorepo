import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  getOwnerWorth,
  rememberOwnerWorth,
} from '@onekeyhq/kit/src/views/Home/components/TokenListBlock/ownerWorthCache';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  getOwnerReplayFrames,
  rememberOwnerReplayFrame,
} from './ownerFrameReplayCache';

export interface IPrewarmHomeTokenListOwnerParams {
  networkId: string | undefined;
  deriveType: IAccountDeriveTypes | undefined;
  indexedAccountId?: string;
  othersWalletAccountId?: string;
}

const inFlight = new Map<string, Promise<boolean>>();

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
  if (!params.networkId) {
    return false;
  }
  const key = paramsKey(params);
  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }
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
      const storeName = EJotaiContextStoreNames.homeTokenList;
      if (getOwnerReplayFrames({ storeName, ownerKey })?.structure) {
        return true;
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
      return true;
    } catch {
      return false;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, run);
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
