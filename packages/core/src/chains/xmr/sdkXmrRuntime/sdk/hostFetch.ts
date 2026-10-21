import type { IPrivacyChainHostRequest } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';

/**
 * The channel the Worker's node requests are relayed through. Extension,
 * desktop and mobile override this with a channel free of CORS and mixed
 * content, since monerod sends no CORS headers unless proxied.
 *
 * `undefined` means the runtime's own fetch, which is right for plain web.
 * Never fill this in with a page `fetch`: every carrier would silently fall
 * back under browser rules.
 */
export const xmrHostFetch: IPrivacyChainHostRequest | undefined = undefined;
