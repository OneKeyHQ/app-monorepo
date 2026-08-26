import { unwrapElectronIpcError } from '../../errors/utils/electronIpcError';

import desktopSecureStorage from './index.desktop';
import { SECURE_STORAGE_PERMANENT_READ_ERROR_NAME } from './types';

// Pins the delivery of the permanent-read label across the REAL desktop IPC
// error path: only `message` survives the DESKTOP_API_CALL boundary
// (makeIpcSafeError preserves it verbatim; Electron wraps it in the
// "Error invoking remote method" envelope; unwrapElectronIpcError rebuilds
// the error under its own hardcoded name), so the renderer-side adapter must
// restore `name` from the message sentinel. A hand-tagged error object would
// not catch a broken transport — this test builds the wire shape end to end.

type IGlobalWithProxy = {
  desktopApiProxy?: {
    storage?: {
      secureGetItemAsync: (key: string) => Promise<string | null | undefined>;
    };
  };
};

// what apps/desktop/app/libs/store.ts throws in the main process
function buildMainProcessError(message: string): Error {
  // makeIpcSafeError: new Error(error.message) — only message survives
  return new Error(message);
}

// what Electron's ipcRenderer.invoke rejection looks like on the renderer
function wrapInIpcEnvelope(mainError: Error): Error {
  return new Error(
    `Error invoking remote method 'DESKTOP_API_CALL': Error: ${mainError.message}`,
  );
}

// what desktopApiProxy.call throws after unwrapping
function buildRendererRejection(mainMessage: string): unknown {
  return unwrapElectronIpcError(
    wrapInIpcEnvelope(buildMainProcessError(mainMessage)),
  );
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

  it('restores the permanent-read name from the message sentinel', async () => {
    installProxyRejectingWith(
      buildRendererRejection(
        `[${SECURE_STORAGE_PERMANENT_READ_ERROR_NAME}] failed to decrypt secure item`,
      ),
    );

    let thrown: unknown;
    await desktopSecureStorage.getSecureItem('any-key').catch((error) => {
      thrown = error;
    });
    expect((thrown as Error).name).toBe(
      SECURE_STORAGE_PERMANENT_READ_ERROR_NAME,
    );
    expect((thrown as Error).message).toContain('failed to decrypt');
  });

  it('leaves unlabeled failures unlabeled (transient by default)', async () => {
    installProxyRejectingWith(
      buildRendererRejection('safeStorage is not available'),
    );

    let thrown: unknown;
    await desktopSecureStorage.getSecureItem('any-key').catch((error) => {
      thrown = error;
    });
    expect((thrown as Error).name).not.toBe(
      SECURE_STORAGE_PERMANENT_READ_ERROR_NAME,
    );
    expect((thrown as Error).message).toBe('safeStorage is not available');
  });
});
