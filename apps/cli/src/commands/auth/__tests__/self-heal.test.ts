import { AppError } from '../../../errors';
import { SignerSoftwareBase } from '../../../signer/base/SignerSoftwareBase';
import { triggerSelfHeal } from '../_internal/self-heal';

import type { IVaultMutationResult } from '../../../infra/vault/client';
import type { IServiceResponse } from '../../../infra/vault/service-client';
import type { IVaultPlaintext } from '../../../infra/vault/types';

const T0 = 1_714_000_000_000;

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
    sessionLabels: {
      'key-1': {
        displayAddress: '0x1234567890abcdef',
        sourceLabel: 'BotWallet',
      },
    },
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

describe('self-heal pipeline', () => {
  it.each([
    ['TOKEN_INVALID', 'SESSION_EXPIRED'],
    ['REVOKED', 'SESSION_EXPIRED'],
    ['KEY_NOT_FOUND', 'SERVICE_KEY_NOT_FOUND'],
  ] as const)('logs out and maps %s to %s', async (reason, code) => {
    const logoutPipeline = jest.fn(async () => undefined);

    await expect(
      triggerSelfHeal(reason, { logoutPipeline }),
    ).rejects.toMatchObject({ code });
    expect(logoutPipeline).toHaveBeenCalledTimes(1);
  });

  it('does not self-heal service unreachable failures', async () => {
    const selfHeal = jest.fn(async () => {
      throw new AppError(
        'SESSION_EXPIRED',
        'expired',
        'Import the Bot Wallet again.',
      );
    });
    const vaultClient = new RecordedVaultClient(createVault(), []);
    const signer = new SignerSoftwareBase({
      fetchKey: jest.fn(
        async (): Promise<IServiceResponse> => ({
          kind: 'fail-secure',
          reason: 'SERVICE_UNREACHABLE',
        }),
      ),
      selfHeal,
      vaultClient,
    });

    await expect(signer.getHdCredential()).rejects.toMatchObject({
      code: 'SERVICE_UNREACHABLE',
    });
    expect(selfHeal).not.toHaveBeenCalled();
  });

  it('releases the vault lock before triggering self-heal logout', async () => {
    const events: string[] = [];
    const selfHeal = jest.fn(async () => {
      events.push('self-heal');
      throw new AppError(
        'SERVICE_KEY_NOT_FOUND',
        'missing',
        'Import the Bot Wallet again.',
      );
    });
    const vaultClient = new RecordedVaultClient(createVault(), events);
    const signer = new SignerSoftwareBase({
      fetchKey: jest.fn(
        async (): Promise<IServiceResponse> => ({
          kind: 'self-heal',
          reason: 'KEY_NOT_FOUND',
        }),
      ),
      selfHeal,
      vaultClient,
    });

    await expect(signer.getHdCredential()).rejects.toMatchObject({
      code: 'SERVICE_KEY_NOT_FOUND',
    });
    expect(events).toEqual(['lock:acquire', 'lock:release', 'self-heal']);
  });
});
