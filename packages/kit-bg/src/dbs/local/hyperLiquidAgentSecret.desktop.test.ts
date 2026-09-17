import 'fake-indexeddb/auto';

import { encodePasswordAsync } from '@onekeyhq/core/src/secret';
import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { HyperLiquidAgentSecretSession } from './hyperLiquidAgentSecret';

let mockSettingsReadErrorMessage: string | undefined;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isExtension: false,
    isNative: false,
  },
}));

jest.mock('../../states/jotai/atoms/settings', () => ({
  settingsPersistAtom: {
    get: jest.fn(async () => {
      if (mockSettingsReadErrorMessage) {
        const errorMessage = mockSettingsReadErrorMessage;
        mockSettingsReadErrorMessage = undefined;
        throw new OneKeyLocalError(errorMessage);
      }
      return {
        sensitiveEncodeKey: 'test-desktop-sensitive-encode-key',
      };
    }),
  },
}));

type ITestDesktopSessionPayload = {
  ciphertext: string;
  iv: string;
  unlocked: boolean;
  version: 1;
};

type IDeferred = {
  promise: Promise<void>;
  resolve: () => void;
};

type ISessionOperationPause = {
  notifyStarted: () => void;
  waitUntilResumed: Promise<void>;
};

function buildDeferred(): IDeferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('HyperLiquid agent Desktop process session', () => {
  let mainProcessPayload: ITestDesktopSessionPayload | undefined;
  let failNextSessionWrite = false;
  let sessionReadPause: ISessionOperationPause | undefined;
  let sessionWritePause: ISessionOperationPause | undefined;
  const originalDesktopApiProxyDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'desktopApiProxy',
  );

  beforeAll(() => {
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        security: {
          clearHyperLiquidAgentSession: async () => {
            mainProcessPayload = undefined;
          },
          getHyperLiquidAgentSession: async () => {
            const payload = mainProcessPayload
              ? { ...mainProcessPayload }
              : undefined;
            const pause = sessionReadPause;
            if (pause) {
              sessionReadPause = undefined;
              pause.notifyStarted();
              await pause.waitUntilResumed;
            }
            return payload;
          },
          setHyperLiquidAgentSession: async (
            payload: ITestDesktopSessionPayload,
          ) => {
            if (failNextSessionWrite) {
              failNextSessionWrite = false;
              throw new OneKeyLocalError('Mock Desktop session write failure');
            }
            const pause = sessionWritePause;
            if (pause) {
              sessionWritePause = undefined;
              pause.notifyStarted();
              await pause.waitUntilResumed;
            }
            mainProcessPayload = { ...payload };
          },
        },
      },
    });
  });

  beforeEach(() => {
    mockSettingsReadErrorMessage = undefined;
  });

  afterEach(() => {
    failNextSessionWrite = false;
    mainProcessPayload = undefined;
    sessionReadPause = undefined;
    sessionWritePause = undefined;
  });

  afterAll(() => {
    if (originalDesktopApiProxyDescriptor) {
      Object.defineProperty(
        globalThis,
        'desktopApiProxy',
        originalDesktopApiProxyDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis, 'desktopApiProxy');
    }
  });

  it('restores the unlocked key after renderer reload but not process restart', async () => {
    const password = await encodePasswordAsync({
      password: 'test-desktop-password',
    });
    const firstRendererSession = new HyperLiquidAgentSecretSession();
    await firstRendererSession.unlock({ password });
    await firstRendererSession.setPersistedSessionUnlocked(true);

    expect(JSON.stringify(mainProcessPayload)).not.toContain(
      'test-desktop-password',
    );

    const reloadedRendererSession = new HyperLiquidAgentSecretSession();
    await expect(
      reloadedRendererSession.restorePersistedSession(),
    ).resolves.toEqual({ restored: true, unlocked: true });

    const credential = {
      agentAddress: '0x2222222222222222222222222222222222222222',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      userAddress: '0x1111111111111111111111111111111111111111',
      validUntil: 2_000_000_000_000,
    };
    const recordId = accountUtils.buildHyperLiquidAgentCredentialId({
      agentName: credential.agentName,
      userAddress: credential.userAddress,
    });
    const encrypted = await reloadedRendererSession.encryptCredential({
      credential,
      recordId,
    });
    await expect(
      reloadedRendererSession.decryptCredential({
        credential: encrypted,
        recordId,
      }),
    ).resolves.toEqual(credential);

    // A new Electron main process starts with a fresh in-memory session store.
    mainProcessPayload = undefined;
    const restartedAppSession = new HyperLiquidAgentSecretSession();
    await expect(
      restartedAppSession.restorePersistedSession(),
    ).resolves.toEqual({ restored: false, unlocked: false });
  });

  it('removes the process session when the app locks', async () => {
    const password = await encodePasswordAsync({
      password: 'test-desktop-password',
    });
    const session = new HyperLiquidAgentSecretSession();
    await session.unlock({ password });
    await session.setPersistedSessionUnlocked(true);

    await session.clear();

    expect(mainProcessPayload).toBeUndefined();
    const reloadedRendererSession = new HyperLiquidAgentSecretSession();
    await expect(
      reloadedRendererSession.restorePersistedSession(),
    ).resolves.toEqual({ restored: false, unlocked: false });
  });

  it('removes a stale key when a replacement session cannot be persisted', async () => {
    const oldPassword = await encodePasswordAsync({
      password: 'test-desktop-old-password',
    });
    const newPassword = await encodePasswordAsync({
      password: 'test-desktop-new-password',
    });
    const session = new HyperLiquidAgentSecretSession();
    await session.unlock({ password: oldPassword });
    await session.setPersistedSessionUnlocked(true);

    failNextSessionWrite = true;
    await expect(session.unlock({ password: newPassword })).rejects.toThrow(
      'Mock Desktop session write failure',
    );
    expect(mainProcessPayload).toBeUndefined();

    const reloadedRendererSession = new HyperLiquidAgentSecretSession();
    await expect(
      reloadedRendererSession.restorePersistedSession(),
    ).resolves.toEqual({ restored: false, unlocked: false });
  });

  it('does not restore a key after a concurrent clear starts', async () => {
    const password = await encodePasswordAsync({
      password: 'test-desktop-password',
    });
    const firstRendererSession = new HyperLiquidAgentSecretSession();
    await firstRendererSession.unlock({ password });
    await firstRendererSession.setPersistedSessionUnlocked(true);

    const readStarted = buildDeferred();
    const resumeRead = buildDeferred();
    sessionReadPause = {
      notifyStarted: readStarted.resolve,
      waitUntilResumed: resumeRead.promise,
    };
    const reloadedRendererSession = new HyperLiquidAgentSecretSession();
    const restorePromise = reloadedRendererSession.restorePersistedSession();
    await readStarted.promise;

    const clearPromise = reloadedRendererSession.clear();
    resumeRead.resolve();

    await expect(restorePromise).resolves.toEqual({
      restored: false,
      unlocked: false,
    });
    await clearPromise;
    expect(reloadedRendererSession.isReady()).toBe(false);
    expect(mainProcessPayload).toBeUndefined();
  });

  it('does not persist a replacement key after a concurrent clear starts', async () => {
    const oldPassword = await encodePasswordAsync({
      password: 'test-desktop-old-password',
    });
    const newPassword = await encodePasswordAsync({
      password: 'test-desktop-new-password',
    });
    const session = new HyperLiquidAgentSecretSession();
    await session.unlock({ password: oldPassword });
    await session.setPersistedSessionUnlocked(true);

    const writeStarted = buildDeferred();
    const resumeWrite = buildDeferred();
    sessionWritePause = {
      notifyStarted: writeStarted.resolve,
      waitUntilResumed: resumeWrite.promise,
    };
    const unlockPromise = session.unlock({ password: newPassword });
    await writeStarted.promise;

    const clearPromise = session.clear();
    resumeWrite.resolve();

    await expect(unlockPromise).rejects.toThrow(
      'HyperLiquid agent session operation was superseded',
    );
    await clearPromise;
    expect(session.isReady()).toBe(false);
    expect(mainProcessPayload).toBeUndefined();
  });

  it('cannot restore a stale payload written after clear completes', async () => {
    const password = await encodePasswordAsync({
      password: 'test-desktop-password',
    });
    const session = new HyperLiquidAgentSecretSession();
    await session.unlock({ password });
    await session.setPersistedSessionUnlocked(true);
    const stalePayload = mainProcessPayload
      ? { ...mainProcessPayload }
      : undefined;
    expect(stalePayload).toBeDefined();

    await session.clear();
    mainProcessPayload = stalePayload;

    const reloadedRendererSession = new HyperLiquidAgentSecretSession();
    await expect(
      reloadedRendererSession.restorePersistedSession(),
    ).resolves.toEqual({ restored: false, unlocked: false });
    expect(reloadedRendererSession.isReady()).toBe(false);
    expect(mainProcessPayload).toBeUndefined();
  });

  it('invalidates the old session when replacement key derivation fails', async () => {
    const [oldPassword, newPassword] = await Promise.all([
      encodePasswordAsync({ password: 'test-desktop-old-password' }),
      encodePasswordAsync({ password: 'test-desktop-new-password' }),
    ]);
    const session = new HyperLiquidAgentSecretSession();
    await session.unlock({ password: oldPassword });
    await session.setPersistedSessionUnlocked(true);
    const stalePayload = mainProcessPayload
      ? { ...mainProcessPayload }
      : undefined;
    expect(stalePayload).toBeDefined();
    mockSettingsReadErrorMessage = 'Mock derivation failure';

    await expect(session.unlock({ password: newPassword })).rejects.toThrow(
      'Mock derivation failure',
    );
    expect(session.isReady()).toBe(false);
    expect(mainProcessPayload).toBeUndefined();

    mainProcessPayload = stalePayload;
    const reloadedRendererSession = new HyperLiquidAgentSecretSession();
    await expect(
      reloadedRendererSession.restorePersistedSession(),
    ).resolves.toEqual({ restored: false, unlocked: false });
  });
});
