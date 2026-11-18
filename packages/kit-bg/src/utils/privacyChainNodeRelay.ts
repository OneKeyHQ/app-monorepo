import { createFetchStreamHandler } from '@onekeyhq/shared/src/utils/fetchStream';
import type { IFetchStreamRequester } from '@onekeyhq/shared/types/fetchStream';

import { isPrivacyChainRelayTargetAllowed } from './privacyChainRelayTargets';

import type { IPrivacyChainRelayTargetSource } from './privacyChainRelayTargets';

const NOT_A_CONFIGURED_NODE = 'not a configured privacy-chain node';

export function createPrivacyChainFetchStreamRelay(
  targets: IPrivacyChainRelayTargetSource,
  fetchImpl?: typeof fetch,
): IFetchStreamRequester {
  const handler = createFetchStreamHandler(fetchImpl);
  return async (request) => {
    if (request.action !== 'open') {
      return handler(request);
    }
    if ((request.method ?? 'GET').toUpperCase() !== 'POST') {
      return { ok: false, error: 'unsupported fetch method' };
    }
    let href: string;
    try {
      href = new URL(request.url).href;
      if (!(await isPrivacyChainRelayTargetAllowed(href, targets))) {
        return { ok: false, error: NOT_A_CONFIGURED_NODE };
      }
    } catch (error) {
      // The extension listener replies only on resolve; never reject.
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    return handler({ ...request, url: href });
  };
}
