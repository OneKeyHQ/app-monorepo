import type { IPrivacyChainHostRequest } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

/**
 * Desktop: fetch from the Electron main process, which is not subject to the
 * renderer's CORS and mixed-content rules.
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
    // Fail loudly: the renderer's fetch would silently lose most nodes.
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
