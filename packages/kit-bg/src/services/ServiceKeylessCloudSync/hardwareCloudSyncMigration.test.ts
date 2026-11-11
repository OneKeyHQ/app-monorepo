import { createHash } from 'crypto';

import { EDeviceType } from '@onekeyfe/hd-shared';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import type {
  IHardwareCloudSyncSession,
  IKeylessCloudSyncCredential,
} from '@onekeyhq/shared/types/keylessCloudSync';

import localDb from '../../dbs/local/localDb';
import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';
import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import {
  commitHardwareCloudSyncMigration,
  migrateHardwareCloudSyncRecords,
  recoverHardwareCloudSyncMigration,
} from './hardwareCloudSyncMigration';
import {
  bootstrapHardwareCloudSyncDataKey,
  createHardwareCloudSyncDeviceKey,
  isHardwareCloudSyncKeyEnvelopeItem,
} from './hardwareCloudSyncSession';

import type { IServerSyncRecord } from './hardwareCloudSyncSession';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBCloudSyncItem } from '../../dbs/local/types';
import type { AxiosInstance } from 'axios';

let mockStored: IKeylessCloudSyncCredential | undefined;
let mockSelected: string | undefined;
let mockPersistedSelected: string | undefined;

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: jest.fn() } },
    account: {
      secretPerf: {
        decodePassword: jest.fn(),
        decodePasswordDone: jest.fn(),
        keyFromPasswordAndSalt: jest.fn(),
        keyFromPasswordAndSaltDone: jest.fn(),
        decryptAES: jest.fn(),
        decryptAESDone: jest.fn(),
      },
    },
  },
}));
jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: { updateSyncItem: jest.fn() },
}));
jest.mock('../../states/jotai/atoms', () => ({
  primeCloudSyncPersistAtom: {
    get: jest.fn(async () => ({
      isCloudSyncEnabledKeyless: true,
      hardwareCloudSyncKeySource: { credentialId: mockSelected },
    })),
    set: jest.fn(
      async (
        update: (value: unknown) => {
          hardwareCloudSyncKeySource: { credentialId: string };
        },
      ) => {
        const next = update({
          isCloudSyncEnabledKeyless: true,
          hardwareCloudSyncKeySource: { credentialId: mockSelected },
        });
        mockSelected = next.hardwareCloudSyncKeySource.credentialId;
        mockPersistedSelected = mockSelected;
      },
    ),
  },
}));
jest.mock('../ServiceKeylessWallet/utils/keylessSyncCredentialStorage', () => ({
  __esModule: true,
  default: {
    getPendingHardwareKeyMigration: jest.fn(async () =>
      mockStored?.pendingHardwareKeyMigration ? mockStored : undefined,
    ),
    saveCredential: jest.fn(async (value: IKeylessCloudSyncCredential) => {
      mockStored = value;
    }),
  },
}));

type ISpace = {
  lock: { data: string } | null;
  records: IServerSyncRecord[];
  nonce: number;
  pwdHash: string;
};
type IBody = {
  expectedPwdHash?: string;
  expectedNonce?: number;
  pwdHash?: string;
  lock?: { data: string };
  localData?: IServerSyncRecord[];
  skip?: number;
  limit?: number;
};
const ok = <T>(data: T) => ({ data: { code: 0, message: 'ok', data } });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(systemTimeUtils, 'ensureFreshServerTime').mockResolvedValue(true);
  jest
    .spyOn(systemTimeUtils, 'getEstimatedServerTime')
    .mockImplementation(() => Date.now());
});
afterEach(() => jest.restoreAllMocks());

async function setup() {
  const spaces = new Map<string, ISpace>(
    ['source', 'target'].map((id) => [
      id,
      { lock: null, records: [], nonce: 0, pwdHash: '' },
    ]),
  );
  let loseTargetFlushReply = false;
  let changeSourceDuringDownload = false;
  const writes: string[] = [];
  const spaceFor = (config: { headers: Record<string, string> }) => {
    const id = config.headers.Authorization.replace('DPoP ', '');
    const space = spaces.get(id);
    if (!space) throw new OneKeyLocalError('Unknown test identity');
    return { id, space };
  };
  const get = jest.fn(
    async (_url: string, config: { headers: Record<string, string> }) =>
      ok({ lock: spaceFor(config).space.lock }),
  );
  const post = jest.fn(
    async (
      url: string,
      body: IBody,
      config: { headers: Record<string, string> },
    ) => {
      const { id, space } = spaceFor(config);
      if (url.endsWith('/check')) return ok({ nonce: space.nonce });
      if (url.endsWith('/download')) {
        if (id === 'source' && changeSourceDuringDownload) space.nonce += 1;
        return ok({
          serverData: space.records.slice(
            body.skip ?? 0,
            body.limit === undefined
              ? undefined
              : (body.skip ?? 0) + body.limit,
          ),
        });
      }
      if (!url.endsWith('/flush'))
        throw new OneKeyLocalError('Unexpected test endpoint');
      if (
        body.expectedPwdHash !== space.pwdHash ||
        (body.expectedNonce !== undefined && body.expectedNonce !== space.nonce)
      )
        throw new OneKeyLocalError('Snapshot changed');
      space.lock = body.lock ?? null;
      space.records = body.localData ?? [];
      space.pwdHash = body.pwdHash ?? '';
      space.nonce += 1;
      writes.push(id);
      if (id === 'target' && loseTargetFlushReply) {
        loseTargetFlushReply = false;
        throw new OneKeyLocalError('Reply lost after target flush');
      }
      return ok({});
    },
  );
  const client = {
    get,
    post,
    defaults: { baseURL: 'http://localhost:7001' },
  } as unknown as AxiosInstance;
  const credentials: IKeylessCloudSyncCredential[] = [];
  for (const id of ['source', 'target']) {
    const session: IHardwareCloudSyncSession = {
      deviceKeyJwk: createHardwareCloudSyncDeviceKey(),
      accessToken: id,
      accessTokenExpiresAt: Date.now() + 600_000,
      refreshToken: `${id}-refresh`,
      sessionId: `${id}-session`,
      dekId: '',
    };
    const key = await bootstrapHardwareCloudSyncDataKey({
      client,
      session,
      deriveKek: async (salt) =>
        createHash('sha256').update(`${id}:${salt}`).digest('hex'),
    });
    credentials.push({
      keylessWalletId: `hardware-cloud-v1-${id}`,
      signingPrivateKey: '',
      signingPublicKey: '',
      encryptionKey: key.dek,
      pwdHash: key.pwdHash,
      hardwareSession: { ...session, dekId: key.dekId },
      source: {
        type: 'hardware',
        credentialId: `hardware-cloud-v1-${id}`,
        deviceName: id,
        deviceType: EDeviceType.Pro2,
        derivationVersion: 1,
      },
    });
  }
  const [source, target] = credentials;
  const sourceSpace = spaces.get('source');
  const targetSpace = spaces.get('target');
  if (!sourceSpace || !targetSpace)
    throw new OneKeyLocalError('Missing test spaces');
  const payloads = ['public account data', 'opaque future record'];
  for (let index = 0; index < payloads.length; index += 1) {
    const key = `record-${index}`;
    const dataType = index ? 'FutureCloudRecord' : 'IndexedAccount';
    sourceSpace.records.push({
      key,
      dataType,
      dataTimestamp: index + 1,
      data: await keylessCloudSyncUtils.encryptWithKeylessKey({
        rawData: payloads[index],
        encryptionKey: source.encryptionKey,
        itemId: key,
        dataType,
      }),
    });
  }
  sourceSpace.records.push({
    key: 'deleted',
    dataType: 'FutureCloudRecord',
    data: '',
    dataTimestamp: 3,
    isDeleted: true,
  });
  writes.length = 0;
  const savePending = jest.fn(
    async (
      pending: NonNullable<
        IKeylessCloudSyncCredential['pendingHardwareKeyMigration']
      >,
    ) => {
      source.pendingHardwareKeyMigration = pending;
    },
  );
  const beforeFlush = jest.fn(async () => undefined);
  const run = (
    isCurrent: () => boolean = () => true,
    overwriteTargetSnapshot?: string,
  ) =>
    migrateHardwareCloudSyncRecords({
      client,
      source,
      target,
      isCurrent,
      savePending,
      beforeFlush,
      overwriteTargetSnapshot,
    });
  return {
    client,
    source,
    target,
    sourceSpace,
    targetSpace,
    writes,
    savePending,
    beforeFlush,
    run,
    loseNextReply: () => {
      loseTargetFlushReply = true;
    },
    changeSourceOnDownload: () => {
      changeSourceDuringDownload = true;
    },
  };
}

test('copies all records to the separately authenticated wallet and keeps the source unchanged', async () => {
  const test = await setup();
  const before = structuredClone(test.sourceSpace);
  await test.run();
  expect(test.sourceSpace).toEqual(before);
  expect(test.writes).toEqual(['target']);
  expect(test.targetSpace.records.map((item) => item.key)).toEqual(
    expect.arrayContaining(['record-0', 'record-1', 'deleted']),
  );
  for (const record of test.targetSpace.records.filter((item) =>
    item.key.startsWith('record-'),
  )) {
    const raw = await keylessCloudSyncUtils.decryptWithKeylessKey({
      encryptedData: record.data ?? '',
      encryptionKey: test.target.encryptionKey,
      itemId: record.key,
      dataType: record.dataType,
    });
    expect(raw).toBe(
      record.key === 'record-0'
        ? 'public account data'
        : 'opaque future record',
    );
  }
  expect(test.savePending).toHaveBeenCalledWith(
    expect.objectContaining({ target: test.target, phase: 'prepared' }),
  );
  expect(test.beforeFlush).toHaveBeenCalledTimes(1);
});

test('a populated target requires explicit confirmation before writing', async () => {
  const test = await setup();
  test.targetSpace.records.push({
    key: 'existing',
    dataType: 'IndexedAccount',
    data: 'existing ciphertext',
  });
  const before = structuredClone(test.targetSpace);
  await expect(test.run()).rejects.toThrow('already has synced data');
  expect(test.targetSpace).toEqual(before);
  expect(test.writes).toEqual([]);
  expect(test.savePending).not.toHaveBeenCalled();
});

async function populatedTarget() {
  const test = await setup();
  test.targetSpace.records.push({
    key: 'existing-target-only',
    dataType: 'IndexedAccount',
    data: 'previous target ciphertext',
    dataTimestamp: 42,
  });
  const failure: unknown = await test.run().catch((error: unknown) => error);
  expect(failure).toMatchObject({
    key: 'cloud_sync_hardware_switch_target_has_data__msg',
    autoToast: false,
    info: { targetCredentialId: test.target.keylessWalletId },
  });
  const snapshot = (failure as IOneKeyError<{ targetSnapshotHash: string }>)
    .info?.targetSnapshotHash;
  if (!snapshot) throw new OneKeyLocalError('Missing overwrite confirmation');
  expect(snapshot).toMatch(/^[\da-f]{64}$/);
  return { ...test, snapshot };
}

test('confirmation permits replacing target data while retaining the original source', async () => {
  const test = await populatedTarget();
  const sourceBefore = structuredClone(test.sourceSpace);
  await test.run(() => true, test.snapshot);
  expect(test.writes).toEqual(['target']);
  expect(test.targetSpace.records.map((record) => record.key)).not.toContain(
    'existing-target-only',
  );
  expect(test.targetSpace.records.map((record) => record.key)).toEqual(
    expect.arrayContaining(['record-0', 'record-1', 'deleted']),
  );
  expect(test.sourceSpace).toEqual(sourceBefore);
});

test.each(['nonce', 'data', 'source', 'target'] as const)(
  'overwrite confirmation is bound to the %s snapshot',
  async (change) => {
    const test = await populatedTarget();
    if (change === 'nonce') test.targetSpace.nonce += 1;
    if (change === 'data')
      test.targetSpace.records[1].data = 'changed ciphertext';
    if (change === 'source')
      test.source.keylessWalletId = 'hardware-cloud-v1-other-source';
    if (change === 'target')
      test.target.keylessWalletId = 'hardware-cloud-v1-other-target';
    await expect(test.run(() => true, test.snapshot)).rejects.toMatchObject({
      key: 'cloud_sync_hardware_switch_target_has_data__msg',
      info: { targetSnapshotHash: expect.not.stringMatching(test.snapshot) },
    });
    expect(test.writes).toEqual([]);
  },
);

test('a write after overwrite confirmation still fails the server nonce guard', async () => {
  const test = await populatedTarget();
  test.beforeFlush.mockImplementationOnce(async () => {
    test.targetSpace.nonce += 1;
  });
  await expect(test.run(() => true, test.snapshot)).rejects.toThrow(
    'Snapshot changed',
  );
  expect(test.writes).toEqual([]);
});

test('a lost flush reply can be retried using the persisted exact upload hash', async () => {
  const test = await setup();
  test.loseNextReply();
  await expect(test.run()).rejects.toThrow('Reply lost');
  expect(test.source.pendingHardwareKeyMigration).toBeDefined();
  await test.run();
  expect(test.writes).toEqual(['target', 'target']);
});

test('a target edited after a lost reply is not mistaken for a retry', async () => {
  const test = await setup();
  test.loseNextReply();
  await expect(test.run()).rejects.toThrow('Reply lost');
  test.targetSpace.records.push({
    key: 'new-data',
    dataType: 'FutureCloudRecord',
    data: 'changed',
  });
  await expect(test.run()).rejects.toThrow('already has synced data');
  expect(test.writes).toEqual(['target']);
});

test('the target nonce guards writes that race the migration', async () => {
  const test = await setup();
  test.beforeFlush.mockImplementationOnce(async () => {
    test.targetSpace.nonce += 1;
  });
  await expect(test.run()).rejects.toThrow('Snapshot changed');
  expect(test.writes).toEqual([]);
});

test('cancellation after the journal is saved leaves both server spaces unchanged', async () => {
  const test = await setup();
  let current = true;
  const sourceBefore = structuredClone(test.sourceSpace);
  const targetBefore = structuredClone(test.targetSpace);
  test.savePending.mockImplementationOnce(async (pending) => {
    test.source.pendingHardwareKeyMigration = pending;
    current = false;
  });
  await expect(test.run(() => current)).rejects.toBeDefined();
  expect(test.sourceSpace).toEqual(sourceBefore);
  expect(test.targetSpace).toEqual(targetBefore);
  expect(test.beforeFlush).not.toHaveBeenCalled();
});

test('a source write during the download prevents migration', async () => {
  const test = await setup();
  test.changeSourceOnDownload();
  await expect(test.run()).rejects.toThrow('Synced data changed');
  expect(test.writes).toEqual([]);
  expect(test.savePending).not.toHaveBeenCalled();
});

test('a source upload during the target flush keeps the old selection retryable', async () => {
  const test = await setup();
  test.beforeFlush.mockImplementationOnce(async () => {
    test.sourceSpace.records.push({
      key: 'late-source-item',
      dataType: 'FutureCloudRecord',
      data: '',
      dataTimestamp: 99,
      isDeleted: true,
    });
    test.sourceSpace.nonce += 1;
  });
  await expect(test.run()).rejects.toThrow('Synced data changed');
  expect(test.writes).toEqual(['target']);
  expect(test.source.pendingHardwareKeyMigration?.phase).toBe('prepared');
  await test.run();
  expect(test.writes).toEqual(['target', 'target']);
  expect(test.targetSpace.records.map((record) => record.key)).toContain(
    'late-source-item',
  );
});

test('an unbounded snapshot preserves more than 1000 records', async () => {
  const test = await setup();
  for (let index = 0; index < 1001; index += 1) {
    test.sourceSpace.records.push({
      key: `deleted-${index}`,
      dataType: 'FutureCloudRecord',
      data: '',
      dataTimestamp: index + 4,
      isDeleted: true,
    });
  }
  await test.run();
  expect(test.targetSpace.records.map((record) => record.key)).toContain(
    'deleted-1000',
  );
  expect(
    test.sourceSpace.records
      .filter((record) => !isHardwareCloudSyncKeyEnvelopeItem(record))
      .every((record) =>
        test.targetSpace.records.some((copy) => copy.key === record.key),
      ),
  ).toBe(true);
});

test('unreadable source ciphertext aborts before writing the target', async () => {
  const test = await setup();
  const record = test.sourceSpace.records.find(
    (item) => item.key === 'record-0',
  );
  if (record) record.data = 'not-ciphertext';
  await expect(test.run()).rejects.toBeDefined();
  expect(test.writes).toEqual([]);
  expect(test.savePending).not.toHaveBeenCalled();
});

test('duplicate source keys abort before writing the target', async () => {
  const test = await setup();
  test.sourceSpace.records.push({
    key: 'record-0',
    dataType: 'IndexedAccount',
  });
  await expect(test.run()).rejects.toThrow();
  expect(test.writes).toEqual([]);
});

async function localSetup() {
  const test = await setup();
  const record = test.sourceSpace.records.find(
    (item) => item.key === 'record-0',
  );
  if (!record) throw new OneKeyLocalError('Missing test record');
  const items: IDBCloudSyncItem[] = [
    {
      id: record.key,
      data: record.data ?? '',
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      dataTime: 1,
      isDeleted: false,
      rawKey: '',
      rawData: '',
      pwdHash: test.source.pwdHash,
      localSceneUpdated: false,
      serverUploaded: true,
    },
  ];
  mockSelected = test.source.keylessWalletId;
  mockPersistedSelected = mockSelected;
  mockStored = {
    ...test.source,
    pendingHardwareKeyMigration: {
      target: test.target,
      recordsHash: 'public-test-hash',
      phase: 'prepared',
    },
  };
  jest
    .spyOn(localDb, 'updateSyncItem')
    .mockImplementation(async ({ ids, updater }) => {
      for (const item of items) {
        if (ids.includes(item.id))
          Object.assign(item, await updater({ ...item }));
      }
    });
  const backgroundApi = {
    servicePrimeCloudSync: { getAllLocalSyncItems: async () => ({ items }) },
  } as unknown as IBackgroundApi;
  const source = mockStored;
  const commit = () =>
    commitHardwareCloudSyncMigration({
      backgroundApi,
      source,
      target: test.target,
    });
  return { ...test, items, backgroundApi, commit };
}

test('local cutover retains a durable journal until both ciphertext and selection use B', async () => {
  const test = await localSetup();
  await test.commit();
  expect(mockSelected).toBe(test.target.keylessWalletId);
  expect(mockStored).toEqual(test.target);
  expect(test.items[0].pwdHash).toBe(test.target.pwdHash);
});

test('a selection-write failure restores A and its local ciphertext', async () => {
  const test = await localSetup();
  jest
    .mocked(primeCloudSyncPersistAtom.set)
    .mockRejectedValueOnce(new OneKeyLocalError('Selection write failed'));
  await expect(test.commit()).rejects.toThrow('Selection write failed');
  expect(mockSelected).toBe(test.source.keylessWalletId);
  expect(mockStored?.pendingHardwareKeyMigration?.phase).toBe('prepared');
  expect(test.items[0].pwdHash).toBe(test.source.pwdHash);
});

test('startup finishes B after selection was persisted but the final credential write was interrupted', async () => {
  const test = await localSetup();
  if (mockStored?.pendingHardwareKeyMigration)
    mockStored.pendingHardwareKeyMigration.phase = 'committing';
  mockSelected = test.target.keylessWalletId;
  await recoverHardwareCloudSyncMigration(test.backgroundApi);
  expect(mockStored).toEqual(test.target);
  expect(test.items[0].pwdHash).toBe(test.target.pwdHash);
});

test('recovery durably rewrites B when the selection write updated memory before rejecting', async () => {
  const test = await localSetup();
  jest
    .mocked(primeCloudSyncPersistAtom.set)
    .mockImplementationOnce(async (update) => {
      if (typeof update !== 'function')
        throw new OneKeyLocalError('Expected updater');
      const next = update(await primeCloudSyncPersistAtom.get());
      mockSelected = next.hardwareCloudSyncKeySource?.credentialId;
      throw new OneKeyLocalError('Selection persistence failed');
    });
  await test.commit();
  expect(mockSelected).toBe(test.target.keylessWalletId);
  expect(mockPersistedSelected).toBe(test.target.keylessWalletId);
  expect(primeCloudSyncPersistAtom.set).toHaveBeenCalledTimes(2);
  expect(mockStored).toEqual(test.target);
});

test('repeated persistence failures retain both keys and recover A after restart', async () => {
  const test = await localSetup();
  const failAfterMemoryUpdate: typeof primeCloudSyncPersistAtom.set = async (
    update,
  ) => {
    if (typeof update !== 'function')
      throw new OneKeyLocalError('Expected updater');
    const next = update(await primeCloudSyncPersistAtom.get());
    mockSelected = next.hardwareCloudSyncKeySource?.credentialId;
    throw new OneKeyLocalError('Selection persistence failed');
  };
  jest
    .mocked(primeCloudSyncPersistAtom.set)
    .mockImplementationOnce(failAfterMemoryUpdate)
    .mockImplementationOnce(failAfterMemoryUpdate);
  await expect(test.commit()).rejects.toThrow('Selection persistence failed');
  expect(mockSelected).toBe(test.target.keylessWalletId);
  expect(mockPersistedSelected).toBe(test.source.keylessWalletId);
  expect(mockStored?.keylessWalletId).toBe(test.source.keylessWalletId);
  expect(mockStored?.pendingHardwareKeyMigration?.phase).toBe('committing');
  expect(mockStored?.pendingHardwareKeyMigration?.target).toEqual(test.target);
  mockSelected = mockPersistedSelected;
  await recoverHardwareCloudSyncMigration(test.backgroundApi);
  expect(test.items[0].pwdHash).toBe(test.source.pwdHash);
  expect(mockStored?.pendingHardwareKeyMigration?.phase).toBe('prepared');
});
