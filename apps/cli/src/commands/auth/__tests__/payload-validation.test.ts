import { ZodError } from 'zod';

import type { ICliBotWalletEncryptedCredential } from '@onekeyhq/shared/src/types/cliBotWallet';

import { cliBotWalletPayloadSchema } from '../../../schemas/cli-bot-wallet-payload';
import { executeLoginPipeline } from '../_internal/login-pipeline';

const validCiphertextBase64 = Buffer.alloc(29, 1).toString('base64');

const validPayload: ICliBotWalletEncryptedCredential = {
  version: 1,
  walletId: 'wallet-1',
  ciphertextBase64: validCiphertextBase64,
  keyId: 'A'.repeat(43),
  accessToken: 'B'.repeat(43),
  sourceLabel: 'BotWallet',
  algorithm: 'aes-256-gcm',
};

describe('CLI BotWallet payload validation', () => {
  it('accepts the CLI-specific payload constraints', () => {
    expect(cliBotWalletPayloadSchema.parse(validPayload)).toEqual(validPayload);
  });

  it('rejects displayAddress in the wire payload (sender must not supply chain identity)', () => {
    expect(() =>
      cliBotWalletPayloadSchema.parse({
        ...validPayload,
        // Intentionally inject a forbidden field to verify schema strict mode.
        displayAddress: '0xabc',
      } as unknown as ICliBotWalletEncryptedCredential),
    ).toThrow(ZodError);
  });

  it('rejects keyId values that are not 32-byte base64url ids', () => {
    expect(() =>
      cliBotWalletPayloadSchema.parse({
        ...validPayload,
        keyId: 'key-1',
      }),
    ).toThrow(ZodError);
  });

  it('rejects accessToken values that are not 32-byte base64url ids', () => {
    expect(() =>
      cliBotWalletPayloadSchema.parse({
        ...validPayload,
        accessToken: 'token-1',
      }),
    ).toThrow(ZodError);
  });

  it('rejects invalid payloads before login side effects', async () => {
    const logoutPipeline = jest.fn(() => Promise.resolve());
    const createMasterKey = jest.fn(() => Promise.resolve(Buffer.alloc(32, 1)));
    const vaultClient = {
      initialize: jest.fn(() => Promise.resolve()),
    };

    await expect(
      executeLoginPipeline(
        {
          kind: 'cli-bot-wallet',
          // A sender-provided displayAddress must be rejected by the wire schema.
          payload: {
            ...validPayload,
            displayAddress: '0xabc',
          } as unknown as ICliBotWalletEncryptedCredential,
        },
        {
          logoutPipeline,
          createMasterKey,
          vaultClient,
        },
      ),
    ).rejects.toBeInstanceOf(ZodError);

    expect(logoutPipeline).not.toHaveBeenCalled();
    expect(createMasterKey).not.toHaveBeenCalled();
    expect(vaultClient.initialize).not.toHaveBeenCalled();
  });
});
