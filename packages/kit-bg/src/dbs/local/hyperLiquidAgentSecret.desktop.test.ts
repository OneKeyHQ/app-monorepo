import 'fake-indexeddb/auto';

import { encodePasswordAsync } from '@onekeyhq/core/src/secret';
import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { HyperLiquidAgentSecretSession } from './hyperLiquidAgentSecret';

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
    get: jest.fn(async () => ({
      sensitiveEncodeKey: 'test-desktop-sensitive-encode-key',
    })),
  },
}));

type ITestDesktopSessionPayload = {
  ciphertext: string;
  iv: string;
  unlocked: boolean;
  version: 1;
};

describe('HyperLiquid agent Desktop process session', () => {
  let mainProcessPayload: ITestDesktopSessionPayload | undefined;
  let failNextSessionWrite = false;
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
          getHyperLiquidAgentSession: async () =>
            mainProcessPayload ? { ...mainProcessPayload } : undefined,
          setHyperLiquidAgentSession: async (
            payload: ITestDesktopSessionPayload,
          ) => {
            if (failNextSessionWrite) {
              failNextSessionWrite = false;
              throw new OneKeyLocalError('Mock Desktop session write failure');
            }
            mainProcessPayload = { ...payload };
          },
        },
      },
    });
  });

  afterEach(() => {
    failNextSessionWrite = false;
    mainProcessPayload = undefined;
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
});
