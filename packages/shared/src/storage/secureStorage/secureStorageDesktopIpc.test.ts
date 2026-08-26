import { unwrapElectronIpcError } from '../../errors/utils/electronIpcError';

import desktopSecureStorage from './index.desktop';
import {
  SECURE_STORAGE_PERMANENT_READ_ERROR_NAME,
  buildSecureStoragePermanentReadErrorMessage,
} from './types';

// Pins the delivery of the permanent-read label across the REAL desktop IPC
// error path: only `message` survives the DESKTOP_API_CALL boundary
// (makeIpcSafeError preserves it verbatim — and also copies the NAME, so
// Electron's envelope tail is `${name}: ${message}`, which
// parseInnerPayload's `^Error:` strip does NOT remove; unwrapElectronIpcError
// then rebuilds the error under its own hardcoded name). The renderer-side
// adapter must restore `name` from the message sentinel under BOTH tail
// shapes. The message is derived from the shared builder — the same one the
// producer uses — so a format change breaks this test instead of silently
// breaking the transport.

type IGlobalWithProxy = {
  desktopApiProxy?: {
    storage?: {
      secureGetItemAsync: (key: string) => Promise<string | null | undefined>;
    };
  };
};

// what apps/desktop/app/libs/store.ts throws in the main process, after
// makeIpcSafeError's `new Error(error.message)` + `safeError.name =
// error.name` normalization
function buildMainDecryptError(): Error {
  const mainError = new Error(
    buildSecureStoragePermanentReadErrorMessage(
      'failed to decrypt secure item',
    ),
  );
  mainError.name = SECURE_STORAGE_PERMANENT_READ_ERROR_NAME;
  return mainError;
}

// what Electron's ipcRenderer.invoke rejection looks like on the renderer:
// the envelope tail is the main error's own `${name}: ${message}` rendering
function wrapInIpcEnvelope(mainError: Error): Error {
  return new Error(
    `Error invoking remote method 'DESKTOP_API_CALL': ${mainError.name}: ${mainError.message}`,
  );
}

// what desktopApiProxy.call throws after unwrapping
function buildRendererRejection(mainError: Error): unknown {
  return unwrapElectronIpcError(wrapInIpcEnvelope(mainError));
}

describe('desktop secure storage IPC error labeling', () => {
  afterEach(() => {
    delete (globalThis as IGlobalWithProxy).desktopApiProxy;
  });

  const installProxyRejectingWith = (rejection: unknown) => {
    (globalThis as IGlobalWithProxy).desktopApiProxy = {
      storage: {
        secureGetItemAsync: jest.fn().mockRejectedValue(rejection),
      },
    };
  };

  const readAndCatch = async (): Promise<Error> => {
    let thrown: unknown;
    await desktopSecureStorage.getSecureItem('any-key').catch((error) => {
      thrown = error;
    });
    return thrown as Error;
  };

  it('restores the permanent-read name from the production envelope shape (sentinel-named tail)', async () => {
    installProxyRejectingWith(buildRendererRejection(buildMainDecryptError()));

    const thrown = await readAndCatch();
    expect(thrown.name).toBe(SECURE_STORAGE_PERMANENT_READ_ERROR_NAME);
    expect(thrown.message).toContain('failed to decrypt');
  });

  it('restores the permanent-read name from a plain-Error tail as well', async () => {
    // the shape produced if the main-side error ever loses its custom name
    // (`Error: <message>` tail, which parseInnerPayload strips)
    const plainNamed = buildMainDecryptError();
    plainNamed.name = 'Error';
    installProxyRejectingWith(buildRendererRejection(plainNamed));

    const thrown = await readAndCatch();
    expect(thrown.name).toBe(SECURE_STORAGE_PERMANENT_READ_ERROR_NAME);
  });

  it('leaves unlabeled failures unlabeled (transient by default)', async () => {
    const unlabeled = new Error('safeStorage is not available');
    installProxyRejectingWith(buildRendererRejection(unlabeled));

    const thrown = await readAndCatch();
    expect(thrown.name).not.toBe(SECURE_STORAGE_PERMANENT_READ_ERROR_NAME);
    expect(thrown.message).toBe('safeStorage is not available');
  });
});
