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

describe('SimpleDbEntityWalletConnectPay.truncateActionResults', () => {
  const params = {
    paymentId: 'payment',
    optionId: 'option',
    accountKey: 'account',
  };
  // a mined first leg followed by the leg a later probe found reverted
  const entries = [
    {
      fingerprint: 'f0',
      result: '0xtxid-mined',
      broadcastMeta: { sender: '0xabc', nonce: 7 },
    },
    { fingerprint: 'f1', result: '0xtxid-reverted' },
  ];

  // property-typed view of the mock so its functions can be handed to
  // expect() without tripping unbound-method (the storage interface declares
  // them as methods)
  const secureStorageMock = appStorage.secureStorage as unknown as Record<
    'getSecureItem' | 'setSecureItem' | 'removeSecureItem',
    jest.Mock
  >;

  function buildEntity() {
    const entity = new SimpleDbEntityWalletConnectPay();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue({ progress: {} });
    return { entity, setRawData };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the whole record when the retained prefix cannot be rewritten', async () => {
    // Deleting the record here would erase the mined leg's txid, and the
    // next attempt would start from action zero and broadcast it again. A
    // surviving stale tail only costs a re-probe on resume.
    const { entity, setRawData } = buildEntity();
    mockSecureStorage.getSecureItem.mockResolvedValueOnce(
      JSON.stringify(entries),
    );
    const writeFailure = new Error('keychain write failed');
    mockSecureStorage.setSecureItem.mockRejectedValueOnce(writeFailure);

    await expect(
      entity.truncateActionResults({ ...params, fromIndex: 1 }),
    ).rejects.toBe(writeFailure);

    expect(secureStorageMock.removeSecureItem).not.toHaveBeenCalled();
    expect(setRawData).not.toHaveBeenCalled();
  });

  it('rewrites only the retained prefix on a mid-sequence discard', async () => {
    const { entity, setRawData } = buildEntity();
    mockSecureStorage.getSecureItem.mockResolvedValueOnce(
      JSON.stringify(entries),
    );
    mockSecureStorage.setSecureItem.mockResolvedValueOnce(undefined);

    await entity.truncateActionResults({ ...params, fromIndex: 1 });

    expect(secureStorageMock.setSecureItem).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(secureStorageMock.setSecureItem.mock.calls[0][1] as string),
    ).toEqual([entries[0]]);
    expect(secureStorageMock.removeSecureItem).not.toHaveBeenCalled();
    expect(setRawData).toHaveBeenCalledTimes(1);
  });

  it('deletes the whole record only for an explicit fromIndex 0 discard', async () => {
    const { entity } = buildEntity();
    mockSecureStorage.getSecureItem.mockResolvedValueOnce(
      JSON.stringify(entries),
    );
    mockSecureStorage.removeSecureItem.mockResolvedValueOnce(undefined);

    await entity.truncateActionResults({ ...params, fromIndex: 0 });

    expect(secureStorageMock.setSecureItem).not.toHaveBeenCalled();
    expect(secureStorageMock.removeSecureItem).toHaveBeenCalledTimes(1);
  });
});
