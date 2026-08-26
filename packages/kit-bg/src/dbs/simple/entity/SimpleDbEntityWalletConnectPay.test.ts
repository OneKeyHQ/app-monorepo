import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { SECURE_STORAGE_PERMANENT_READ_ERROR_NAME } from '@onekeyhq/shared/src/storage/secureStorage/types';

import { SimpleDbEntityWalletConnectPay } from './SimpleDbEntityWalletConnectPay';

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    secureStorage: {
      getSecureItem: jest.fn(),
      setSecureItem: jest.fn(),
      removeSecureItem: jest.fn(),
      supportSecureStorage: jest.fn(),
    },
  },
  storageHub: {
    appStorage: {},
  },
}));

const mockSecureStorage = jest.mocked(appStorage.secureStorage);

// readSecureEntries is private on purpose; these tests reach through the
// type because its verdict decides whether a DESTRUCTIVE path opens
// (`corrupt` → the user-confirmed discard escape) and the classification
// has no other observable seam this narrow.
async function readVerdict(): Promise<{ status: string }> {
  const entity = new SimpleDbEntityWalletConnectPay();
  return (
    entity as unknown as {
      readSecureEntries: (key: string) => Promise<{ status: string }>;
    }
  ).readSecureEntries('payment__option__account');
}

describe('SimpleDbEntityWalletConnectPay.readSecureEntries verdicts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('classifies ANY throwing read as unreadable — the permanent-labeled kind included, never corrupt', async () => {
    // The invariant behind the discard escape: `corrupt` is a CONTENT
    // verdict (payload decoded, provably not a record, cannot carry a
    // txid) and is the only verdict allowed to unlock the destructive
    // user-confirmed discard. A read failure is an ACCESS verdict — the
    // payload may be an intact record holding a broadcast txid — so even
    // an adapter-labeled PERMANENT failure must classify as unreadable.
    const labeled = new Error('failed to decrypt secure item');
    labeled.name = SECURE_STORAGE_PERMANENT_READ_ERROR_NAME;
    mockSecureStorage.getSecureItem.mockRejectedValueOnce(labeled);

    const labeledVerdict = await readVerdict();
    expect(labeledVerdict.status).not.toBe('corrupt');
    expect(labeledVerdict.status).toBe('unreadable');

    mockSecureStorage.getSecureItem.mockRejectedValueOnce(
      new Error('keychain locked'),
    );
    const unlabeledVerdict = await readVerdict();
    expect(unlabeledVerdict.status).toBe('unreadable');
  });

  it('classifies a missing payload as absent', async () => {
    mockSecureStorage.getSecureItem.mockResolvedValueOnce(null);
    await expect(readVerdict()).resolves.toEqual({ status: 'absent' });
  });

  it('classifies valid JSON of a non-array shape as corrupt', async () => {
    mockSecureStorage.getSecureItem.mockResolvedValueOnce(
      JSON.stringify({ not: 'a record' }),
    );
    await expect(readVerdict()).resolves.toEqual({ status: 'corrupt' });
  });

  it('classifies unparseable plaintext as unreadable, not corrupt', async () => {
    // decrypt garbage on adapters that return garbage instead of throwing
    // must stay on the conservative verdict
    mockSecureStorage.getSecureItem.mockResolvedValueOnce('%%% not json %%%');
    await expect(readVerdict()).resolves.toEqual({ status: 'unreadable' });
  });

  it('classifies a well-formed entries array as ok', async () => {
    mockSecureStorage.getSecureItem.mockResolvedValueOnce(
      JSON.stringify([{ fingerprint: 'f', result: '0xabc' }]),
    );
    const verdict = await readVerdict();
    expect(verdict.status).toBe('ok');
  });
});
