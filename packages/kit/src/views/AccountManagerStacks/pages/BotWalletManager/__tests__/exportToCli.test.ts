/* eslint-disable onekey/no-raw-error -- tests intentionally simulate raw failures from injected deps */
import type { ICliBotWalletRevealableSeed } from '@onekeyhq/shared/src/types/cliBotWallet';

import { exportBotWalletToCli } from '../exportToCli';

const validCiphertextBase64 = Buffer.alloc(29, 1).toString('base64');

const fixtureSeed: ICliBotWalletRevealableSeed = {
  entropyWithLangPrefixed: `0110${'00'.repeat(32)}`,
  seed: 'a'.repeat(128),
};

const baseInput = {
  walletId: 'wallet-1',
  sourceLabel: 'desktop:bot:Trader-Yuna',
};

function makeDeps(
  overrides: Partial<Parameters<typeof exportBotWalletToCli>[1]> = {},
) {
  return {
    getRevealableSeed: jest.fn(async () => fixtureSeed),
    encryptCredential: jest.fn(() => ({
      ciphertextBase64: validCiphertextBase64,
      randomKey: Buffer.from('A'.repeat(32)),
    })),
    registerKey: jest.fn(async () => ({
      keyId: 'K'.repeat(43),
      accessToken: 'T'.repeat(43),
    })),
    revokeKey: jest.fn(async () => undefined),
    secureWipe: jest.fn((b: Buffer) => b.fill(0)),
    ...overrides,
  } as unknown as Parameters<typeof exportBotWalletToCli>[1] & {
    getRevealableSeed: jest.Mock;
    encryptCredential: jest.Mock;
    registerKey: jest.Mock;
    revokeKey: jest.Mock;
    secureWipe: jest.Mock;
  };
}

describe('exportBotWalletToCli (AC10/AC11)', () => {
  it('happy path: produces a valid ICliBotWalletEncryptedCredential with all 7 fields (no displayAddress)', async () => {
    const deps = makeDeps();
    const payload = await exportBotWalletToCli(baseInput, deps);
    expect(Object.keys(payload).toSorted()).toEqual([
      'accessToken',
      'algorithm',
      'ciphertextBase64',
      'keyId',
      'sourceLabel',
      'version',
      'walletId',
    ]);
    expect(payload).not.toHaveProperty('displayAddress');
    expect(payload.version).toBe(1);
    expect(payload.algorithm).toBe('aes-256-gcm');
    expect(payload.walletId).toBe('wallet-1');
    expect(payload.keyId).toBe('K'.repeat(43));
    expect(payload.accessToken).toBe('T'.repeat(43));
    expect(payload.ciphertextBase64).toBe(validCiphertextBase64);
    expect(payload.sourceLabel).toBe('desktop:bot:Trader-Yuna');

    // Service was called exactly once with NO ciphertext / mnemonic / walletId
    // (the registerKey wrapper enforces this; here we verify it was invoked).
    expect(deps.registerKey).toHaveBeenCalledTimes(1);
    expect(deps.registerKey.mock.calls[0][0]).toMatch(/^[A-Za-z0-9+/=]+$/);

    // No revoke happens on the happy path.
    expect(deps.revokeKey).not.toHaveBeenCalled();

    // randomKey was wiped exactly once.
    expect(deps.secureWipe).toHaveBeenCalledTimes(1);
    const wipedBuf = deps.secureWipe.mock.calls[0][0] as Buffer;
    expect(wipedBuf.every((b) => b === 0)).toBe(true);
  });

  it('encrypt failure: does NOT call registerKey or revokeKey', async () => {
    const deps = makeDeps({
      encryptCredential: jest.fn(() => {
        // eslint-disable-next-line no-restricted-syntax
        throw new Error('encrypt boom');
      }),
    });
    await expect(exportBotWalletToCli(baseInput, deps)).rejects.toThrow(
      /encrypt boom/,
    );
    expect(
      (deps as unknown as { registerKey: jest.Mock }).registerKey,
    ).not.toHaveBeenCalled();
    expect(
      (deps as unknown as { revokeKey: jest.Mock }).revokeKey,
    ).not.toHaveBeenCalled();
  });

  it('register failure: re-throws and does NOT call revokeKey (no keyId issued)', async () => {
    const deps = makeDeps({
      registerKey: jest.fn(async () => {
        // eslint-disable-next-line no-restricted-syntax
        throw new Error('ECONNREFUSED');
      }),
    });
    await expect(exportBotWalletToCli(baseInput, deps)).rejects.toThrow(
      /ECONNREFUSED/,
    );
    expect(
      (deps as unknown as { revokeKey: jest.Mock }).revokeKey,
    ).not.toHaveBeenCalled();
    // randomKey is wiped even on register failure (no orphan plaintext key)
    expect(
      (deps as unknown as { secureWipe: jest.Mock }).secureWipe,
    ).toHaveBeenCalledTimes(1);
  });

  it('payload assembly failure (post-register): triggers best-effort revoke + re-throws', async () => {
    // Simulate a flow where register succeeds but the input fails schema —
    // pass an empty walletId so cliBotWalletEncryptedCredentialSchema rejects.
    const deps = makeDeps();
    await expect(
      exportBotWalletToCli({ ...baseInput, walletId: '' }, deps),
    ).rejects.toThrow();
    expect(
      (deps as unknown as { revokeKey: jest.Mock }).revokeKey,
    ).toHaveBeenCalledTimes(1);
    expect(
      (deps as unknown as { revokeKey: jest.Mock }).revokeKey.mock.calls[0],
    ).toEqual(['K'.repeat(43), 'T'.repeat(43), { baseUrl: undefined }]);
  });

  it('post-register payload transfer failure: revokes issued key + re-throws', async () => {
    const deps = makeDeps({
      onPayloadReady: jest.fn(() => {
        // eslint-disable-next-line no-restricted-syntax
        throw new Error('transfer failed');
      }),
    });
    await expect(exportBotWalletToCli(baseInput, deps)).rejects.toThrow(
      /transfer failed/,
    );
    expect(
      (deps as unknown as { revokeKey: jest.Mock }).revokeKey.mock.calls[0],
    ).toEqual(['K'.repeat(43), 'T'.repeat(43), { baseUrl: undefined }]);
  });

  it('does NOT populate the legacy decryptedCredentials path (FR7)', async () => {
    const deps = makeDeps();
    const payload = (await exportBotWalletToCli(baseInput, deps)) as Record<
      string,
      unknown
    >;
    expect(payload.decryptedCredentials).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('decryptedCredentials');
  });

  it('register body never contains ciphertext/mnemonic/walletId/displayAddress', async () => {
    let capturedRegisterArg: string | undefined;
    const deps = makeDeps({
      registerKey: jest.fn(async (keyBase64) => {
        capturedRegisterArg = keyBase64;
        return { keyId: 'K'.repeat(43), accessToken: 'T'.repeat(43) };
      }),
    });
    await exportBotWalletToCli(baseInput, deps);
    // The registerKey wrapper takes only the random key as a positional arg.
    // The downstream POST body shape is asserted in register.test.ts; here we
    // just confirm exportBotWalletToCli passes a plain base64 key.
    expect(typeof capturedRegisterArg).toBe('string');
    expect(capturedRegisterArg).not.toContain(validCiphertextBase64);
    expect(capturedRegisterArg).not.toContain('wallet-1');
    expect(capturedRegisterArg).not.toContain('Trader-Yuna');
  });
});
