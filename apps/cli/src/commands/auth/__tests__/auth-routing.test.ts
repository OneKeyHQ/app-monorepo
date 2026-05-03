import { expectTypeOf } from 'expect-type';

import type {
  ICliBotWalletEncryptedCredential,
  ILegacyDefaultPayload,
  IPersistAuthSessionInput,
} from '@onekeyhq/shared/src/types/cliBotWallet';

import {
  LoginPipelineError,
  routeAuthSession,
} from '../_internal/login-pipeline';

const VALID_CIPHERTEXT_BASE64 = Buffer.alloc(29, 1).toString('base64');

const cliPayload: ICliBotWalletEncryptedCredential = {
  version: 1,
  walletId: 'wallet-1',
  ciphertextBase64: VALID_CIPHERTEXT_BASE64,
  keyId: 'A'.repeat(43),
  accessToken: 'B'.repeat(43),
  sourceLabel: 'BotWallet',
  algorithm: 'aes-256-gcm',
};

const legacyPayload: ILegacyDefaultPayload = {
  encryptedMnemonic: 'encrypted',
  encryptionKey: 'key',
  session: {
    displayAddress: '0x2222222222222222222222222222222222222222',
    sourceLabel: 'Legacy',
  },
};

describe('auth session routing', () => {
  it('routes cli-bot-wallet input to the BotWallet login pipeline', async () => {
    const vaultClient = {
      initialize: jest.fn(() => Promise.resolve()),
    };

    await expect(
      routeAuthSession(
        { kind: 'cli-bot-wallet', payload: cliPayload },
        {
          logoutPipeline: async () => undefined,
          createMasterKey: async () => Buffer.alloc(32, 1),
          vaultClient,
          now: () => 1,
          deriveDisplayAddress: async () => '',
        },
      ),
    ).resolves.toEqual({
      ok: true,
      data: { keyId: cliPayload.keyId },
    });
    expect(vaultClient.initialize).toHaveBeenCalledTimes(1);
  });

  it('routes legacy-default input to the injected legacy handler', async () => {
    const legacyDefaultHandler = jest.fn(() =>
      Promise.resolve({
        ok: true as const,
        data: { keyId: 'legacy' },
      }),
    );

    await expect(
      routeAuthSession(
        { kind: 'legacy-default', payload: legacyPayload },
        { legacyDefaultHandler },
      ),
    ).resolves.toEqual({
      ok: true,
      data: { keyId: 'legacy' },
    });
    expect(legacyDefaultHandler).toHaveBeenCalledWith(legacyPayload);
  });

  it('rejects legacy-default input when no legacy handler is provided', async () => {
    await expect(
      routeAuthSession({ kind: 'legacy-default', payload: legacyPayload }),
    ).rejects.toBeInstanceOf(LoginPipelineError);
  });

  it('requires narrowing before accessing payload-specific fields', () => {
    function assertTypes(input: IPersistAuthSessionInput) {
      // @ts-expect-error payload is a union until narrowed by kind.
      void input.payload.keyId;

      if (input.kind === 'cli-bot-wallet') {
        expectTypeOf(
          input.payload,
        ).toEqualTypeOf<ICliBotWalletEncryptedCredential>();
        expectTypeOf(input.payload.keyId).toEqualTypeOf<string>();
      } else {
        expectTypeOf(input.payload).toEqualTypeOf<ILegacyDefaultPayload>();
        expectTypeOf(input.payload.encryptedMnemonic).toEqualTypeOf<string>();
      }
    }

    void assertTypes;
  });
});
