/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: jest.fn(),
      },
    },
  },
}));

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBaseMock {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  passwordAtom: {
    get: jest.fn(),
  },
  settingsPersistAtom: {
    get: jest.fn(),
  },
}));

jest.mock('../../migrations/indexedToBucketsMigration/legacyIndexedDb', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock(
  '../../migrations/indexedToBucketsMigration/migrateRecordsFn',
  () => ({
    migrateAccountBucketRecords: jest.fn(),
  }),
);

jest.mock('./dbBackupTools', () => ({
  __esModule: true,
  default: {
    backupInstanceMeta: jest.fn(),
  },
}));

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import { EIndexedDBBucketNames } from '../../dbs/local/types';

import ServiceDBBackup from './ServiceDBBackup';

type ICredentialRow = { id: string };
type IAppStatusData = { lastDBBackupTime?: number };

const mockedLoggerAppErrorLog = (
  jest.requireMock('@onekeyhq/shared/src/logger/logger') as {
    defaultLogger: {
      app: {
        error: {
          log: jest.MockedFunction<(message: string) => void>;
        };
      };
    };
  }
).defaultLogger.app.error.log;

const mockedAtoms = jest.requireMock('../../states/jotai/atoms') as {
  passwordAtom: {
    get: jest.MockedFunction<() => Promise<{ unLock: boolean }>>;
  };
  settingsPersistAtom: {
    get: jest.MockedFunction<
      () => Promise<{
        instanceId: string;
        sensitiveEncodeKey: string;
        instanceIdBackup?: string;
      }>
    >;
  };
};

const mockedLegacyIndexedDb = (
  jest.requireMock(
    '../../migrations/indexedToBucketsMigration/legacyIndexedDb',
  ) as {
    default: {
      getAll: jest.MockedFunction<
        (name: ELocalDBStoreNames) => Promise<ICredentialRow[]>
      >;
      delete: jest.MockedFunction<
        (name: ELocalDBStoreNames, id: string) => Promise<void>
      >;
    };
  }
).default;

const mockedMigrateAccountBucketRecords = (
  jest.requireMock(
    '../../migrations/indexedToBucketsMigration/migrateRecordsFn',
  ) as {
    migrateAccountBucketRecords: jest.MockedFunction<
      (params: { tx: unknown; records: unknown }) => Promise<void>
    >;
  }
).migrateAccountBucketRecords;

const mockedDbBackupTools = (
  jest.requireMock('./dbBackupTools') as {
    default: {
      backupInstanceMeta: jest.MockedFunction<(meta: unknown) => Promise<void>>;
    };
  }
).default;

const HL_AGENT_CREDENTIAL_ID =
  'hyperliquid-agent--0x1111111111111111111111111111111111111111--agent_one';
const REGULAR_CREDENTIAL_ID = 'hd-1';

function createService({
  backupCredentials = [],
}: {
  backupCredentials?: ICredentialRow[];
} = {}) {
  const bucketCredentialDelete = jest.fn(
    async (_id: string): Promise<void> => undefined,
  );
  const backupBucketTx = {
    objectStore: jest.fn(() => ({ delete: bucketCredentialDelete })),
  };
  const backupBucketDb = {
    getAll: jest.fn(
      async (_name: ELocalDBStoreNames): Promise<ICredentialRow[]> =>
        backupCredentials,
    ),
    transaction: jest.fn(() => backupBucketTx),
  };
  const primaryBucketDb = {
    getAll: jest.fn(
      async (_name: ELocalDBStoreNames): Promise<ICredentialRow[]> => [],
    ),
  };
  const nativeDb = {
    getIndexedByBucketName: jest.fn((bucketName: EIndexedDBBucketNames) =>
      bucketName === EIndexedDBBucketNames.backupAccount
        ? backupBucketDb
        : primaryBucketDb,
    ),
  };
  const appStatus = {
    getRawData: jest.fn(
      async (): Promise<IAppStatusData | undefined> => undefined,
    ),
    setRawData: jest.fn(
      async (
        _updater: (prev: IAppStatusData | undefined) => IAppStatusData,
      ): Promise<void> => undefined,
    ),
  };
  const servicePassword = {
    hasCachedPassword: jest.fn(async (): Promise<boolean> => true),
  };
  const service = new ServiceDBBackup({
    backgroundApi: {
      localDb: { readyDb: nativeDb },
      simpleDb: { appStatus },
      servicePassword,
    },
  });
  return {
    service,
    nativeDb,
    backupBucketDb,
    backupBucketTx,
    bucketCredentialDelete,
    appStatus,
    servicePassword,
  };
}

describe('ServiceDBBackup', () => {
  const originalPlatformFlags = {
    isExtension: platformEnv.isExtension,
    isDesktop: platformEnv.isDesktop,
    isWeb: platformEnv.isWeb,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isExtension = false;
    platformEnv.isDesktop = true;
    platformEnv.isWeb = false;
    mockedLegacyIndexedDb.getAll.mockResolvedValue([]);
    mockedLegacyIndexedDb.delete.mockResolvedValue(undefined);
    mockedAtoms.passwordAtom.get.mockResolvedValue({ unLock: true });
    mockedAtoms.settingsPersistAtom.get.mockResolvedValue({
      instanceId: 'instance-id',
      sensitiveEncodeKey: 'sensitive-encode-key',
      instanceIdBackup: 'instance-id-backup',
    });
    mockedMigrateAccountBucketRecords.mockResolvedValue(undefined);
    mockedDbBackupTools.backupInstanceMeta.mockResolvedValue(undefined);
  });

  afterEach(() => {
    platformEnv.isExtension = originalPlatformFlags.isExtension;
    platformEnv.isDesktop = originalPlatformFlags.isDesktop;
    platformEnv.isWeb = originalPlatformFlags.isWeb;
    jest.restoreAllMocks();
  });

  describe('removeBackupHyperLiquidAgentCredentials', () => {
    it('returns true and removes only agent credentials when both branches succeed', async () => {
      const { service, bucketCredentialDelete } = createService({
        backupCredentials: [
          { id: HL_AGENT_CREDENTIAL_ID },
          { id: REGULAR_CREDENTIAL_ID },
        ],
      });
      mockedLegacyIndexedDb.getAll.mockResolvedValue([
        { id: HL_AGENT_CREDENTIAL_ID },
        { id: REGULAR_CREDENTIAL_ID },
      ]);

      await expect(
        service.removeBackupHyperLiquidAgentCredentials(),
      ).resolves.toBe(true);

      expect(bucketCredentialDelete).toHaveBeenCalledTimes(1);
      expect(bucketCredentialDelete).toHaveBeenCalledWith(
        HL_AGENT_CREDENTIAL_ID,
      );
      expect(mockedLegacyIndexedDb.delete).toHaveBeenCalledTimes(1);
      expect(mockedLegacyIndexedDb.delete).toHaveBeenCalledWith(
        ELocalDBStoreNames.Credential,
        HL_AGENT_CREDENTIAL_ID,
      );
      expect(mockedLoggerAppErrorLog).not.toHaveBeenCalled();
    });

    it('returns true when no matching records exist', async () => {
      const { service, backupBucketDb, bucketCredentialDelete } = createService(
        {
          backupCredentials: [{ id: REGULAR_CREDENTIAL_ID }],
        },
      );
      mockedLegacyIndexedDb.getAll.mockResolvedValue([
        { id: REGULAR_CREDENTIAL_ID },
      ]);

      await expect(
        service.removeBackupHyperLiquidAgentCredentials(),
      ).resolves.toBe(true);

      expect(backupBucketDb.transaction).not.toHaveBeenCalled();
      expect(bucketCredentialDelete).not.toHaveBeenCalled();
      expect(mockedLegacyIndexedDb.delete).not.toHaveBeenCalled();
      expect(mockedLoggerAppErrorLog).not.toHaveBeenCalled();
    });

    it('returns false when the bucket backup deletion throws', async () => {
      const { service, bucketCredentialDelete } = createService({
        backupCredentials: [{ id: HL_AGENT_CREDENTIAL_ID }],
      });
      bucketCredentialDelete.mockRejectedValue(new Error('bucket tx failed'));

      await expect(
        service.removeBackupHyperLiquidAgentCredentials(),
      ).resolves.toBe(false);

      expect(mockedLoggerAppErrorLog).toHaveBeenCalledWith(
        'Bucket backup HyperLiquid credential cleanup failed',
      );
      // The legacy branch is still attempted even after the bucket branch fails.
      expect(mockedLegacyIndexedDb.getAll).toHaveBeenCalledWith(
        ELocalDBStoreNames.Credential,
      );
    });

    it('returns false when the legacy DB cleanup throws', async () => {
      const { service } = createService();
      mockedLegacyIndexedDb.getAll.mockRejectedValue(
        new Error('legacy db failed'),
      );

      await expect(
        service.removeBackupHyperLiquidAgentCredentials(),
      ).resolves.toBe(false);

      expect(mockedLoggerAppErrorLog).toHaveBeenCalledWith(
        'Legacy backup HyperLiquid credential cleanup failed',
      );
    });

    it('returns true without touching databases when backup is unsupported', async () => {
      platformEnv.isDesktop = false;
      const { service, backupBucketDb } = createService();

      await expect(
        service.removeBackupHyperLiquidAgentCredentials(),
      ).resolves.toBe(true);

      expect(backupBucketDb.getAll).not.toHaveBeenCalled();
      expect(mockedLegacyIndexedDb.getAll).not.toHaveBeenCalled();
    });
  });

  describe('_backupDatabaseDaily', () => {
    it('scrubs stale agent rows inside the snapshot transaction', async () => {
      const {
        service,
        backupBucketDb,
        backupBucketTx,
        bucketCredentialDelete,
      } = createService({
        backupCredentials: [
          { id: HL_AGENT_CREDENTIAL_ID },
          { id: REGULAR_CREDENTIAL_ID },
        ],
      });

      await service._backupDatabaseDaily();

      // Snapshot write and agent-row deletes share the single transaction.
      expect(backupBucketDb.transaction).toHaveBeenCalledTimes(1);
      expect(backupBucketTx.objectStore).toHaveBeenCalledWith(
        ELocalDBStoreNames.Credential,
      );
      expect(bucketCredentialDelete).toHaveBeenCalledTimes(1);
      expect(bucketCredentialDelete).toHaveBeenCalledWith(
        HL_AGENT_CREDENTIAL_ID,
      );
      expect(mockedMigrateAccountBucketRecords).toHaveBeenCalledTimes(1);
      expect(mockedMigrateAccountBucketRecords).toHaveBeenCalledWith(
        expect.objectContaining({ tx: backupBucketTx }),
      );
    });

    it('does not invoke removeBackupHyperLiquidAgentCredentials and advances lastDBBackupTime on success', async () => {
      const { service, appStatus } = createService();
      const cleanupSpy = jest.spyOn(
        service,
        'removeBackupHyperLiquidAgentCredentials',
      );

      await service._backupDatabaseDaily();

      expect(cleanupSpy).not.toHaveBeenCalled();
      expect(mockedMigrateAccountBucketRecords).toHaveBeenCalledTimes(1);
      expect(appStatus.setRawData).toHaveBeenCalledTimes(1);
      const updater = appStatus.setRawData.mock.calls[0][0];
      expect(updater(undefined)).toEqual(
        expect.objectContaining({ lastDBBackupTime: expect.any(Number) }),
      );
    });

    it('still advances lastDBBackupTime when the backup-bucket read throws', async () => {
      const { service, appStatus, backupBucketDb } = createService();
      backupBucketDb.getAll.mockRejectedValue(
        new Error('backup bucket read failed'),
      );
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await service._backupDatabaseDaily();

      // A scrub/snapshot failure must never leave the backup feature
      // permanently dead: the finally block still consumes the 24h window.
      expect(mockedMigrateAccountBucketRecords).not.toHaveBeenCalled();
      expect(backupBucketDb.transaction).not.toHaveBeenCalled();
      expect(appStatus.setRawData).toHaveBeenCalledTimes(1);
      const updater = appStatus.setRawData.mock.calls[0][0];
      expect(updater(undefined)).toEqual(
        expect.objectContaining({ lastDBBackupTime: expect.any(Number) }),
      );
    });
  });
});
