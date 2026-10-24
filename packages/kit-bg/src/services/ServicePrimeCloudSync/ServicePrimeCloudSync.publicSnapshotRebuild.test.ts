import { cloneDeep } from 'lodash';

import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ICloudSyncCredential,
  ICloudSyncRawDataJson,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';

import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import { getPublicAccountSnapshotId } from './publicAccountSnapshot';
import { publicAccountTestSnapshot } from './publicAccountSnapshot.test-utils';
import ServicePrimeCloudSync from './ServicePrimeCloudSync';

import type { IDBCloudSyncItem } from '../../dbs/local/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthroughDecorator =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];

  return {
    backgroundClass: passthroughDecorator,
    backgroundMethod: passthroughDecorator,
    backgroundMethodForDev: passthroughDecorator,
    toastIfError: passthroughDecorator,
  };
});

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBaseMock {
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }

    backgroundApi: unknown;
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  primeCloudSyncPersistAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
  addressBookPersistAtom: {},
  devSettingsPersistAtom: {},
  primeMasterPasswordPersistAtom: {},
  primePersistAtom: {},
}));

jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerAccount', () => ({
  CloudSyncFlowManagerAccount: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerAddressBook', () => ({
  CloudSyncFlowManagerAddressBook: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerBotWallet', () => ({
  CloudSyncFlowManagerBotWallet: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerBrowserBookmark', () => ({
  CloudSyncFlowManagerBrowserBookmark: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomNetwork', () => ({
  CloudSyncFlowManagerCustomNetwork: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomRpc', () => ({
  CloudSyncFlowManagerCustomRpc: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomToken', () => ({
  CloudSyncFlowManagerCustomToken: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerIndexedAccount', () => ({
  CloudSyncFlowManagerIndexedAccount: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerLock', () => ({
  CloudSyncFlowManagerLock: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerMarketWatchList', () => ({
  CloudSyncFlowManagerMarketWatchList: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerWallet', () => ({
  CloudSyncFlowManagerWallet: jest.fn(),
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    addAndUpdateSyncItems: jest.fn(async () => undefined),
    getAccountSafe: jest.fn(),
    getWalletSafe: jest.fn(),
    addAccountsToWallet: jest.fn(),
    importPublicCloudAccounts: jest.fn(),
  },
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('./botWalletCloudSyncUtils', () => ({
  filterBotWalletRecordsByCurrentKeylessSyncScope: jest.fn(),
}));

jest.mock('./cloudSyncCheckUtils', () => ({
  buildOnlyCheckLocalDataTypes: jest.fn(),
}));

// Public synthetic keys used only by these in-memory crypto round trips.
const credential = {
  primeAccountSalt: '',
  securityPasswordR1: '',
  masterPasswordUUID: '',
  keylessCredential: {
    keylessWalletId: 'public-rebuild-test',
    signingPrivateKey: '11'.repeat(32),
    signingPublicKey: '02'.repeat(33),
    encryptionKey: '22'.repeat(32),
    pwdHash: 'keyless-public-rebuild-test',
  },
} satisfies ICloudSyncCredential;

type IRawFixture = {
  dataType: EPrimeCloudSyncDataType;
  rawKey: string;
  payload: {
    accountId: string;
    name: string;
    publicAccountSnapshot: unknown;
    futureField?: boolean;
  };
  futureField?: boolean;
};

function rawFixture(): IRawFixture {
  const snapshot = publicAccountTestSnapshot();
  const accountId = getPublicAccountSnapshotId(snapshot);
  return {
    dataType: EPrimeCloudSyncDataType.Account,
    rawKey: `Account >> ${accountId}`,
    payload: {
      accountId,
      name: snapshot.account.name,
      publicAccountSnapshot: snapshot,
    },
  };
}

function rawItem(raw = rawFixture()): IDBCloudSyncItem {
  return {
    id: sha512ProSync({ data: raw.rawKey }),
    dataType: EPrimeCloudSyncDataType.Account,
    rawKey: raw.rawKey,
    rawData: stringUtils.stableStringify(raw),
    data: undefined,
    dataTime: 1_750_000_000_000,
    isDeleted: true,
    pwdHash: '',
    localSceneUpdated: true,
    serverUploaded: false,
  };
}

function harness(
  items: IDBCloudSyncItem[],
  selected: ICloudSyncCredential | undefined = credential,
) {
  const writePool = jest.spyOn(localDb, 'addAndUpdateSyncItems');
  const getAccount = jest.spyOn(localDb, 'getAccountSafe');
  const getWallet = jest.spyOn(localDb, 'getWalletSafe');
  const createAccounts = jest.spyOn(localDb, 'addAccountsToWallet');
  const importAccounts = jest.spyOn(localDb, 'importPublicCloudAccounts');
  const service = new ServicePrimeCloudSync({ backgroundApi: { localDb } });
  service.syncManagers.account.rawKeyToHashKey = (data) =>
    sha512ProSync({ data });
  const buildTarget = jest.fn(async () => undefined);
  service.syncManagers.account.buildSyncTargetByPayload = buildTarget;
  const getCredential = jest
    .spyOn(service, 'getSyncCredentialSafe')
    .mockResolvedValue(selected);
  const getItems = jest
    .spyOn(service, 'getAllLocalSyncItems')
    .mockResolvedValue({ items });
  const upload = jest
    .spyOn(service, 'apiUploadItems')
    .mockResolvedValue(undefined);
  return {
    service,
    buildTarget,
    getItems,
    getCredential,
    upload,
    writePool,
    getAccount,
    getWallet,
    createAccounts,
    importAccounts,
  };
}

describe('ServicePrimeCloudSync reserved public snapshot rebuilding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  test('encrypts a rawData-only tombstone after its account and wallet are gone', async () => {
    const original = rawItem();
    const previous = cloneDeep(original);
    const {
      service,
      buildTarget,
      upload,
      writePool,
      getAccount,
      getWallet,
      createAccounts,
      importAccounts,
    } = harness([original]);
    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    expect(writePool).toHaveBeenCalledTimes(1);
    const { items, skipUploadToServer } = writePool.mock.calls[0][0];
    expect(skipUploadToServer).toBe(true);
    expect(items).toHaveLength(1);
    const rebuilt = items[0];
    expect(rebuilt).toMatchObject({
      id: original.id,
      isDeleted: true,
      dataTime: original.dataTime,
      localSceneUpdated: true,
      serverUploaded: false,
      rawData: '',
      pwdHash: credential.keylessCredential?.pwdHash,
    });
    expect(rebuilt.data).toBeTruthy();
    const decrypted = await cloudSyncItemBuilder.decryptSyncItem({
      item: { ...rebuilt },
      syncCredential: credential,
    });
    expect(decrypted.rawDataJson).toEqual(rawFixture());
    expect(original).toEqual(previous);
    expect(buildTarget).not.toHaveBeenCalled();
    expect(getAccount).not.toHaveBeenCalled();
    expect(getWallet).not.toHaveBeenCalled();
    expect(createAccounts).not.toHaveBeenCalled();
    expect(importAccounts).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  test.each([
    [
      'future version',
      (raw: IRawFixture) => {
        raw.payload.publicAccountSnapshot = {
          ...publicAccountTestSnapshot(),
          version: 2,
        };
      },
    ],
    [
      'future capability',
      (raw: IRawFixture) => {
        raw.payload.publicAccountSnapshot = {
          ...publicAccountTestSnapshot(),
          capabilities: ['account-copy-v2'],
        };
      },
    ],
    [
      'unknown snapshot field',
      (raw: IRawFixture) => {
        raw.payload.publicAccountSnapshot = {
          ...publicAccountTestSnapshot(),
          futureField: true,
        };
      },
    ],
    [
      'unknown account field',
      (raw: IRawFixture) => {
        raw.payload.publicAccountSnapshot = {
          ...publicAccountTestSnapshot(),
          account: {
            ...publicAccountTestSnapshot().account,
            futureField: true,
          },
        };
      },
    ],
    [
      'unknown payload field',
      (raw: IRawFixture) => {
        raw.payload.futureField = true;
      },
    ],
    [
      'unknown raw envelope field',
      (raw: IRawFixture) => {
        raw.futureField = true;
      },
    ],
  ] as const)(
    'preserves %s unchanged without writes or an echo',
    async (_label, mutate) => {
      const raw = rawFixture();
      mutate(raw);
      const original = rawItem(raw);
      const previous = cloneDeep(original);
      const { service, buildTarget, upload, writePool } = harness([original]);
      const encrypt = jest.spyOn(cloudSyncItemBuilder, 'encryptSyncItem');
      await service.fillingSyncItemsMissingDataFromRawData({
        skipUploadToServer: true,
      });
      expect(original).toEqual(previous);
      expect(encrypt).not.toHaveBeenCalled();
      expect(writePool).not.toHaveBeenCalled();
      expect(buildTarget).not.toHaveBeenCalled();
      expect(upload).not.toHaveBeenCalled();
    },
  );

  test('does not migrate encrypted snapshots from another credential', async () => {
    const raw = rawFixture();
    const item = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
      key: sha512ProSync({ data: raw.rawKey }),
      rawDataJson: raw as ICloudSyncRawDataJson,
      syncCredential: credential,
      dataTime: 1_750_000_000_000,
    });
    item.isDeleted = true;
    const previous = cloneDeep(item);
    const nextCredential: ICloudSyncCredential = {
      ...credential,
      keylessCredential: {
        ...credential.keylessCredential,
        encryptionKey: '33'.repeat(32),
        pwdHash: 'keyless-another-test-owner',
      },
    };
    const { service, buildTarget, upload, writePool } = harness(
      [item],
      nextCredential,
    );
    const encrypt = jest.spyOn(cloudSyncItemBuilder, 'encryptSyncItem');
    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    expect(item).toEqual(previous);
    expect(encrypt).not.toHaveBeenCalled();
    expect(writePool).not.toHaveBeenCalled();
    expect(buildTarget).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  test('without a credential neither scans nor changes local data', async () => {
    const original = rawItem();
    const previous = cloneDeep(original);
    const { service, getItems, getCredential, buildTarget, upload, writePool } =
      harness([original]);
    getCredential.mockResolvedValue(undefined);
    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    expect(original).toEqual(previous);
    expect(getItems).not.toHaveBeenCalled();
    expect(writePool).not.toHaveBeenCalled();
    expect(buildTarget).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
});
