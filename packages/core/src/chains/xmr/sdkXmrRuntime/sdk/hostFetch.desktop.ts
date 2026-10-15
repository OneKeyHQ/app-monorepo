import type { IPrivacyChainHostRequest } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

/**
 * Desktop: fetch from the Electron main process.
 *
 * The renderer is Chromium, so a fetch there obeys CORS and mixed content just
 * as a web page would -- and monerod sends no CORS headers unless it was put
 * behind a proxy. The main process is Node and has neither rule, so this is
 * what makes "point the wallet at any node" true on desktop.
 */
export const xmrHostFetch: IPrivacyChainHostRequest = async (
  url,
  contentType,
  body,
) => {
  const { desktopApi: api } = globalThis as unknown as {
    desktopApi?: {
      privacyChainNodeRequest?: (params: {
        url: string;
        contentType: string;
        body: Uint8Array;
      }) => Promise<
        { ok: true; bytes: Uint8Array } | { ok: false; error: string }
      >;
    };
  };
  if (!api?.privacyChainNodeRequest) {
    // An older shell without the channel. Say so rather than silently falling
    // back to the renderer's fetch, which would quietly narrow the usable
    // nodes back to one and look like it was working.
    throw new OneKeyLocalError(
      'xmr: this desktop build has no main-process request channel; update the app',
    );
  }
  const result = await api.privacyChainNodeRequest({ url, contentType, body });
  if (!result.ok) {
    throw new OneKeyLocalError(result.error);
  }
  return new Uint8Array(result.bytes);
};
