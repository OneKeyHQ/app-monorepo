import { performance } from 'node:perf_hooks';

import { ZodError } from 'zod';

import type { ICliBotWalletEncryptedCredential } from '@onekeyhq/shared/src/types/cliBotWallet';

import {
  createInitialVaultPlaintext,
  executeLoginPipeline,
} from '../_internal/login-pipeline';

import type {
  ILoginPipelineDependencies,
  ILoginPipelineInput,
} from '../_internal/login-pipeline';

type IVaultClientMock = NonNullable<ILoginPipelineDependencies['vaultClient']>;

const VALID_KEY_ID = 'A'.repeat(43);
const VALID_ACCESS_TOKEN = 'B'.repeat(43);
const VALID_CIPHERTEXT_BASE64 = Buffer.alloc(29, 1).toString('base64');
const STUB_DISPLAY_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

function createPayload(
  overrides: Partial<ICliBotWalletEncryptedCredential> = {},
): ICliBotWalletEncryptedCredential {
  return {
    version: 1,
    walletId: 'wallet1',
    ciphertextBase64: VALID_CIPHERTEXT_BASE64,
    keyId: VALID_KEY_ID,
    accessToken: VALID_ACCESS_TOKEN,
    sourceLabel: 'BotWallet',
    algorithm: 'aes-256-gcm',
    ...overrides,
  };
}

describe('auth login pipeline', () => {
  it('logs out first, creates a master key, initializes vault, derives address, and returns keyId', async () => {
    const calls: string[] = [];
    const vaultClient: IVaultClientMock = {
      initialize: jest.fn(async () => {
        calls.push('initialize');
      }),
      atomicMutate: jest.fn(async () => {
        calls.push('atomicMutate');
        return undefined as never;
      }) as IVaultClientMock['atomicMutate'],
    };
    const createMasterKey = jest.fn(async () => {
      calls.push('createMasterKey');
      return Buffer.alloc(32, 1);
    });
    const deriveDisplayAddress = jest.fn(async () => {
      calls.push('deriveDisplayAddress');
      return STUB_DISPLAY_ADDRESS;
    });

    await expect(
      executeLoginPipeline(
        { kind: 'cli-bot-wallet', payload: createPayload() },
        {
          logoutPipeline: async () => {
            calls.push('logout');
          },
          createMasterKey,
          vaultClient,
          now: () => 123,
          deriveDisplayAddress,
        },
      ),
    ).resolves.toEqual({ ok: true, data: { keyId: VALID_KEY_ID } });

    expect(calls).toEqual([
      'logout',
      'createMasterKey',
      'initialize',
      'deriveDisplayAddress',
      'atomicMutate',
    ]);
    expect(vaultClient.initialize).toHaveBeenCalledWith(
      createInitialVaultPlaintext(createPayload(), 123),
    );
  });

  it('keeps logout idempotent when old vault cleanup succeeds with no session', async () => {
    const logoutPipeline = jest.fn(async () => undefined);
    const vaultClient = { initialize: jest.fn(async () => undefined) };

    await executeLoginPipeline(
      {
        kind: 'cli-bot-wallet',
        payload: createPayload({ keyId: 'C'.repeat(43) }),
      },
      {
        logoutPipeline,
        createMasterKey: async () => Buffer.alloc(32, 2),
        vaultClient,
        deriveDisplayAddress: async () => '',
      },
    );

    expect(logoutPipeline).toHaveBeenCalledTimes(1);
    expect(vaultClient.initialize).toHaveBeenCalledTimes(1);
  });

  it('skips the post-init address patch when receiver-side derivation fails', async () => {
    const atomicMutate = jest.fn(async () => undefined as never);
    const vaultClient: IVaultClientMock = {
      initialize: jest.fn(async () => undefined),
      atomicMutate: atomicMutate as IVaultClientMock['atomicMutate'],
    };
    const deriveDisplayAddress = jest.fn(async () => {
      // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error
      throw new Error('key service unreachable');
    });

    await expect(
      executeLoginPipeline(
        { kind: 'cli-bot-wallet', payload: createPayload() },
        {
          logoutPipeline: async () => undefined,
          createMasterKey: async () => Buffer.alloc(32, 5),
          vaultClient,
          deriveDisplayAddress,
        },
      ),
    ).resolves.toEqual({ ok: true, data: { keyId: VALID_KEY_ID } });

    expect(deriveDisplayAddress).toHaveBeenCalledTimes(1);
    expect(atomicMutate).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads before logout or master-key creation', async () => {
    const logoutPipeline = jest.fn(async () => undefined);
    const createMasterKey = jest.fn(async () => Buffer.alloc(32, 3));

    await expect(
      executeLoginPipeline(
        {
          kind: 'cli-bot-wallet',
          payload: createPayload({
            version: 2 as ICliBotWalletEncryptedCredential['version'],
          }),
        },
        {
          logoutPipeline,
          createMasterKey,
          vaultClient: { initialize: jest.fn(async () => undefined) },
        },
      ),
    ).rejects.toBeInstanceOf(ZodError);

    expect(logoutPipeline).not.toHaveBeenCalled();
    expect(createMasterKey).not.toHaveBeenCalled();
  });

  it('builds the initial vault with a single active record and empty address slot', () => {
    const vault = createInitialVaultPlaintext(createPayload(), 123);

    expect(Object.keys(vault.records)).toEqual([VALID_KEY_ID]);
    expect(vault.metadata).toMatchObject({
      activeWalletId: 'wallet1',
      activeKeyId: VALID_KEY_ID,
      vaultCreatedAt: 123,
    });
    // The address cache and sessionLabels.displayAddress are populated by
    // executeLoginPipeline AFTER vault init, via receiver-side derivation.
    expect(vault.cache).toEqual({});
    expect(vault.sessionLabels[VALID_KEY_ID].displayAddress).toBe('');
  });

  it('completes the injected happy path under 200ms', async () => {
    const startedAt = performance.now();

    await executeLoginPipeline(
      { kind: 'cli-bot-wallet', payload: createPayload() },
      {
        logoutPipeline: async () => undefined,
        createMasterKey: async () => Buffer.alloc(32, 4),
        vaultClient: { initialize: jest.fn(async () => undefined) },
        deriveDisplayAddress: async () => '',
      },
    );

    expect(performance.now() - startedAt).toBeLessThan(200);
  });

  it('rejects keyId/walletId-only calls at the type layer', () => {
    const invalidInput = { keyId: 'key1', walletId: 'wallet1' };
    // @ts-expect-error login requires a discriminated CLI BotWallet payload input.
    const typedInput: ILoginPipelineInput = invalidInput;
    expect(typedInput).toBe(invalidInput);
  });
});
