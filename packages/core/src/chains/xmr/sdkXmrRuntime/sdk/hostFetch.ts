import type { IPrivacyChainHostRequest } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';

/**
 * The channel Worker node requests relay through. Extension, desktop and mobile override it
 * (monerod sends no CORS headers); `undefined` means the runtime's own fetch, right for plain web.
 * Never fill it with a page `fetch`: every carrier would silently fall back under browser rules.
 */
export const xmrHostFetch: IPrivacyChainHostRequest | undefined = undefined;
