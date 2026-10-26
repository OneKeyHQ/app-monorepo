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

// Simulate a dev desktop runtime: supportSecureStorage must follow the
// main-process availability probe there, not a blanket build-flavor refusal
// (an old Electron dev safeStorage bug once forced one; it no longer
// reproduces, and the gate broke every secure-storage consumer in dev)
jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual<{ default: object }>('../../platformEnv').default,
    isDesktop: true,
    isDev: true,
    isE2E: false,
  },
}));

type IGlobalWithProxy = {
  desktopApiProxy?: {
    storage?: {
      secureGetItemAsync?: (key: string) => Promise<string | null | undefined>;
      isSecureStorageAvailable?: () => Promise<boolean | undefined>;
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

  it('does not label a message that merely MENTIONS the bare sentinel name', async () => {
    // pins the bare-name -> anchored-prefix tightening: this message would
    // match a naive includes(NAME) matcher and must not be labeled
    installProxyRejectingWith(
      buildRendererRejection(
        new Error(
          `retry after ${SECURE_STORAGE_PERMANENT_READ_ERROR_NAME} seen earlier`,
        ),
      ),
    );

    const thrown = await readAndCatch();
    expect(thrown.name).not.toBe(SECURE_STORAGE_PERMANENT_READ_ERROR_NAME);
  });

  it('does not label a wrapper message that EMBEDS the bracketed prefix mid-string', async () => {
    // pins the anchor: an includes(PREFIX) matcher would still label this
    installProxyRejectingWith(
      buildRendererRejection(
        new Error(
          `Supabase secure storage read failed: ${buildSecureStoragePermanentReadErrorMessage(
            'failed to decrypt secure item',
          )}`,
        ),
      ),
    );

    const thrown = await readAndCatch();
    expect(thrown.name).not.toBe(SECURE_STORAGE_PERMANENT_READ_ERROR_NAME);
  });
});

describe('desktop supportSecureStorage (dev runtime)', () => {
  afterEach(() => {
    delete (globalThis as IGlobalWithProxy).desktopApiProxy;
  });

  const installProxyReportingAvailability = (
    available: boolean | undefined,
  ) => {
    (globalThis as IGlobalWithProxy).desktopApiProxy = {
      storage: {
        isSecureStorageAvailable: jest.fn().mockResolvedValue(available),
      },
    };
  };

  it('follows the main-process availability probe even in dev desktop', async () => {
    installProxyReportingAvailability(true);
    await expect(desktopSecureStorage.supportSecureStorage()).resolves.toBe(
      true,
    );
  });

  it('reports unsupported when the main process says unavailable', async () => {
    installProxyReportingAvailability(false);
    await expect(desktopSecureStorage.supportSecureStorage()).resolves.toBe(
      false,
    );
  });

  it('reports unsupported when the probe is missing (older desktop API)', async () => {
    (globalThis as IGlobalWithProxy).desktopApiProxy = { storage: {} };
    await expect(desktopSecureStorage.supportSecureStorage()).resolves.toBe(
      false,
    );
  });
});
