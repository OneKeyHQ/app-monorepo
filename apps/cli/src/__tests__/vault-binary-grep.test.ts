import type { ICliBotWalletEncryptedCredential } from '@onekeyhq/shared/src/types/cliBotWallet';

// eslint-disable-next-line jest/no-mocks-import
import { createFsMock } from '../__mocks__/fs.mock';
// eslint-disable-next-line jest/no-mocks-import
import { createKeychainStorageMock } from '../__mocks__/keychain-storage.mock';
import { createServiceMock } from '../__test-utils__/service-mock';
import { executeLoginPipeline } from '../commands/auth/_internal/login-pipeline';
import { VaultClient, createMasterKey } from '../infra/vault';

const VAULT_FILE = '/onekey-cli/bot-wallet/vault.enc';
const VAULT_LOCK = `${VAULT_FILE}.lock`;
const MASTER_KEY_ACCOUNT = 'bot-wallet/master-key';

function containsAscii(raw: Buffer, value: string): boolean {
  return raw.includes(Buffer.from(value, 'utf8'));
}

function getVaultTextViews(raw: Buffer): string[] {
  return [raw.toString('utf8'), raw.toString('hex'), raw.toString('base64')];
}

function getEncodedForms(value: string): string[] {
  return [
    value,
    Buffer.from(value, 'utf8').toString('hex'),
    Buffer.from(value, 'utf8').toString('base64'),
  ];
}

function createPayload(): ICliBotWalletEncryptedCredential {
  return {
    version: 1,
    walletId: 'wallet-real-id-20260428',
    ciphertextBase64: Buffer.from(
      'serialized IBip39RevealableSeed encrypted by sender',
      'utf8',
    ).toString('base64'),
    keyId: 'A'.repeat(43),
    accessToken: 'B'.repeat(43),
    sourceLabel: 'OneKey Real Source Label 20260428',
    algorithm: 'aes-256-gcm',
  };
}

describe('vault.enc binary grep', () => {
  it('does not leak sensitive field names or real metadata in raw vault bytes', async () => {
    const fsMock = createFsMock();
    const keychainStorage = createKeychainStorageMock();
    const service = createServiceMock();
    const release = jest.fn(async () => undefined);
    const payload = createPayload();
    const vaultClient = new VaultClient({
      keychainStorage,
      paths: {
        vaultDir: '/onekey-cli/bot-wallet',
        vaultFile: VAULT_FILE,
        vaultLock: VAULT_LOCK,
        masterKeyAccount: MASTER_KEY_ACCOUNT,
      },
      acquireLock: async () => release,
      writeFileAtomic: async (filePath, data) => {
        await fsMock.writeFile(filePath, data);
      },
    });

    try {
      await executeLoginPipeline(
        { kind: 'cli-bot-wallet', payload },
        {
          logoutPipeline: async () => undefined,
          createMasterKey: () =>
            createMasterKey({
              keychainStorage,
              account: MASTER_KEY_ACCOUNT,
              randomBytes: (size) => Buffer.alloc(size, 7),
              now: () => 1_774_630_800_000,
            }),
          vaultClient,
          now: () => 1_774_630_800_000,
          // Stub out receiver-side address derivation so this test only
          // exercises vault writes — the default hook would lazy-load
          // SignerHd and call the local key service (axios.get) to decrypt
          // the credential, which is covered by other tests.
          deriveDisplayAddress: async () => '',
        },
      );

      const rawVault = await fsMock.readFile(VAULT_FILE);

      expect(containsAscii(rawVault, 'OKVAULT1')).toBe(true);

      const vaultViews = getVaultTextViews(rawVault);
      const forbiddenValues = [
        'accessToken',
        'ciphertextBase64',
        'mnemonic',
        'seedPhrase',
        'displayAddress',
        'IBip39RevealableSeed',
        payload.accessToken,
        payload.ciphertextBase64,
        payload.walletId,
        payload.sourceLabel,
      ];

      for (const forbidden of forbiddenValues) {
        for (const encodedForm of getEncodedForms(forbidden)) {
          expect(vaultViews.some((view) => view.includes(encodedForm))).toBe(
            false,
          );
        }
      }

      expect(service.spies.get).not.toHaveBeenCalled();
      expect(service.spies.post).not.toHaveBeenCalled();
      expect(service.spies.delete).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledTimes(1);
    } finally {
      service.restore();
    }
  });
});
