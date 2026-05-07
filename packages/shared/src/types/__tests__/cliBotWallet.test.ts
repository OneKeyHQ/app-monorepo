import { ZodError } from 'zod';

import {
  type ICliBotWalletEncryptedCredential,
  cliBotWalletEncryptedCredentialSchema,
} from '../cliBotWallet';

const validCiphertextBase64 = Buffer.alloc(29, 1).toString('base64');

const validPayload: ICliBotWalletEncryptedCredential = {
  version: 1,
  walletId: 'wallet-1',
  ciphertextBase64: validCiphertextBase64,
  keyId: 'A'.repeat(43),
  accessToken: 'B'.repeat(43),
  sourceLabel: 'desktop:bot:Trader-Yuna',
  algorithm: 'aes-256-gcm',
};

describe('cliBotWalletEncryptedCredentialSchema', () => {
  it('accepts a fully-populated valid payload', () => {
    expect(() =>
      cliBotWalletEncryptedCredentialSchema.parse(validPayload),
    ).not.toThrow();
    const parsed = cliBotWalletEncryptedCredentialSchema.parse(validPayload);
    expect(parsed).toEqual(validPayload);
  });

  it('rejects when a required field is missing', () => {
    const cases: Array<keyof ICliBotWalletEncryptedCredential> = [
      'walletId',
      'ciphertextBase64',
      'keyId',
      'accessToken',
      'sourceLabel',
    ];
    for (const field of cases) {
      const broken: Record<string, unknown> = { ...validPayload };
      delete broken[field];
      expect(() => cliBotWalletEncryptedCredentialSchema.parse(broken)).toThrow(
        ZodError,
      );
    }
  });

  it('rejects displayAddress in the wire payload (sender must not supply chain identity)', () => {
    expect(() =>
      cliBotWalletEncryptedCredentialSchema.parse({
        ...validPayload,
        displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
      }),
    ).toThrow(ZodError);
  });

  it('rejects wrong algorithm literal (e.g. aes-128-cbc)', () => {
    expect(() =>
      cliBotWalletEncryptedCredentialSchema.parse({
        ...validPayload,
        algorithm: 'aes-128-cbc',
      }),
    ).toThrow(ZodError);
  });

  it('rejects version=2 (literal-locked)', () => {
    expect(() =>
      cliBotWalletEncryptedCredentialSchema.parse({
        ...validPayload,
        version: 2,
      }),
    ).toThrow(ZodError);
  });

  it('rejects empty-string fields (no zero-length identifiers)', () => {
    for (const field of [
      'walletId',
      'ciphertextBase64',
      'keyId',
      'accessToken',
    ] as const) {
      expect(() =>
        cliBotWalletEncryptedCredentialSchema.parse({
          ...validPayload,
          [field]: '',
        }),
      ).toThrow(ZodError);
    }
  });

  it('rejects malformed key/token/ciphertext fields', () => {
    for (const patch of [
      { keyId: 'key-id-1' },
      { accessToken: 'access-token-1' },
      { ciphertextBase64: 'AAECAw==' },
      { ciphertextBase64: 'not base64!' },
    ]) {
      expect(() =>
        cliBotWalletEncryptedCredentialSchema.parse({
          ...validPayload,
          ...patch,
        }),
      ).toThrow(ZodError);
    }
  });

  it('rejects extra/unknown fields (strict mode)', () => {
    expect(() =>
      cliBotWalletEncryptedCredentialSchema.parse({
        ...validPayload,
        mnemonic: 'abandon abandon ...', // would be a serious leak if accepted
      }),
    ).toThrow(ZodError);
  });
});
