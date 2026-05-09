import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { AppError } from '../../../errors';
import { SignerSoftwareBase } from '../SignerSoftwareBase';

import type { ISecureCacheKey } from '../../../core/secure-cache';
import type { IVaultMutationResult } from '../../../infra/vault/client';
import type { IServiceResponse } from '../../../infra/vault/service-client';
import type { IVaultPlaintext } from '../../../infra/vault/types';

const T0 = 1_714_000_000_000;
const CACHE_KEY = 'wallet-1:key-1' as ISecureCacheKey;

function createVault(): IVaultPlaintext {
  return {
    schemaVersion: 1,
    records: {
      'key-1': {
        walletId: 'wallet-1',
        accessToken: 'token-1',
        ciphertextBase64: 'ciphertext-1',
        createdAt: T0,
      },
    },
    cache: {},
    metadata: {
      activeWalletId: 'wallet-1',
      activeKeyId: 'key-1',
      schemaVersion: 1,
      vaultCreatedAt: T0,
    },
    sessionLabels: {},
  };
}

class RecordedVaultClient {
  /* eslint-disable no-useless-constructor, no-empty-function */
  constructor(
    private readonly vault: IVaultPlaintext,
    private readonly events: string[],
  ) {}
  /* eslint-enable no-useless-constructor, no-empty-function */

  async atomicMutate<TResult>(
    mutator: (
      currentVault: IVaultPlaintext,
    ) => Promise<IVaultMutationResult<TResult>> | IVaultMutationResult<TResult>,
  ): Promise<TResult> {
    this.events.push('lock:acquire');
    try {
      const mutation = await mutator(this.vault);
      return mutation.result;
    } finally {
      this.events.push('lock:release');
    }
  }
}

function createSessionCache() {
  return {
    get: jest.fn(() => null),
    set: jest.fn<void, [ISecureCacheKey, Buffer]>(),
  };
}

function createWipeRecorder() {
  const wiped: string[] = [];
  const secureWipe = jest.fn((buffer: Buffer) => {
    wiped.push(buffer.toString('utf8'));
    buffer.fill(0);
  });
  return { secureWipe, wiped };
}

describe('SignerSoftwareBase.getHdCredential try/finally cleanup', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('wipes cache-miss buffers on the happy path', async () => {
    const { secureWipe, wiped } = createWipeRecorder();
    const cache = createSessionCache();
    const signer = new SignerSoftwareBase({
      decryptCredential: jest.fn(async () => 'hd-credential'),
      fetchKey: jest.fn(
        async (): Promise<IServiceResponse> => ({
          kind: 'ok',
          keyBase64: 'key-base64',
        }),
      ),
      secureWipe,
      sessionCache: cache,
      vaultClient: new RecordedVaultClient(createVault(), []),
      now: () => T0,
    });

    await expect(signer.getHdCredential()).resolves.toBe('hd-credential');

    expect(wiped).toEqual(
      expect.arrayContaining(['token-1', 'key-base64', 'hd-credential']),
    );
    expect(cache.set).toHaveBeenCalledWith(CACHE_KEY, expect.any(Buffer));
  });

  it('wipes access token and releases lock on self-heal service responses', async () => {
    const events: string[] = [];
    const { secureWipe, wiped } = createWipeRecorder();
    const signer = new SignerSoftwareBase({
      fetchKey: jest.fn(
        async (): Promise<IServiceResponse> => ({
          kind: 'self-heal',
          reason: 'TOKEN_INVALID',
        }),
      ),
      secureWipe,
      selfHeal: jest.fn(async () => {
        events.push('self-heal');
        throw new AppError('SESSION_EXPIRED', 'expired', 'retry');
      }),
      vaultClient: new RecordedVaultClient(createVault(), events),
    });

    await expect(signer.getHdCredential()).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });

    expect(wiped).toContain('token-1');
    expect(events).toEqual(['lock:acquire', 'lock:release', 'self-heal']);
  });

  it('wipes access token and releases lock on service unreachable', async () => {
    const events: string[] = [];
    const { secureWipe, wiped } = createWipeRecorder();
    const signer = new SignerSoftwareBase({
      fetchKey: jest.fn(
        async (): Promise<IServiceResponse> => ({
          kind: 'fail-secure',
          reason: 'SERVICE_UNREACHABLE',
        }),
      ),
      secureWipe,
      vaultClient: new RecordedVaultClient(createVault(), events),
    });

    await expect(signer.getHdCredential()).rejects.toMatchObject({
      code: 'SERVICE_UNREACHABLE',
    });
    expect(wiped).toContain('token-1');
    expect(events).toEqual(['lock:acquire', 'lock:release']);
  });

  it('wipes fetched key when decrypt fails', async () => {
    const { secureWipe, wiped } = createWipeRecorder();
    const cache = createSessionCache();
    const signer = new SignerSoftwareBase({
      decryptCredential: jest.fn(async () => {
        throw new OneKeyLocalError('decrypt failed');
      }),
      fetchKey: jest.fn(
        async (): Promise<IServiceResponse> => ({
          kind: 'ok',
          keyBase64: 'key-base64',
        }),
      ),
      secureWipe,
      sessionCache: cache,
      vaultClient: new RecordedVaultClient(createVault(), []),
    });

    await expect(signer.getHdCredential()).rejects.toThrow('decrypt failed');
    expect(wiped).toContain('key-base64');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('still releases the lock when secureWipe itself fails', async () => {
    const events: string[] = [];
    const secureWipe = jest.fn(() => {
      throw new OneKeyLocalError('wipe failed');
    });
    const signer = new SignerSoftwareBase({
      fetchKey: jest.fn(
        async (): Promise<IServiceResponse> => ({
          kind: 'fail-secure',
          reason: 'SERVICE_UNREACHABLE',
        }),
      ),
      secureWipe,
      vaultClient: new RecordedVaultClient(createVault(), events),
    });

    await expect(signer.getHdCredential()).rejects.toMatchObject({
      code: 'SERVICE_UNREACHABLE',
    });
    expect(events).toEqual(['lock:acquire', 'lock:release']);
  });
});
