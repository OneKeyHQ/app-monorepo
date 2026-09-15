/*
yarn jest packages/kit-bg/src/services/ServiceCloudBackupV2/ServiceCloudBackupV2.availability.test.ts

Pins the availability counting of the cloud backup and restore user flows:
started/outcome series, failure details, the per-platform provider detail and
the in-flight tracking that turns killed flows into `unfinished`.
*/
import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import type {
  IBackupCloudServerDownloadData,
  IBackupDataEncryptedPayload,
} from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import {
  OneKeyLocalError,
  PasswordPromptDialogCancel,
} from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { AvailabilityAggregator } from '@onekeyhq/shared/src/request/availabilityAggregator';
import type {
  IAvailabilityBudgetState,
  IAvailabilityFlow,
  IAvailabilityFlowHandle,
  IAvailabilityFlowResult,
  IAvailabilityWindowsState,
} from '@onekeyhq/shared/src/request/availabilityAggregator';
import { getAvailabilityErrorCode } from '@onekeyhq/shared/src/request/availabilityMetrics';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import ServiceCloudBackupV2 from './ServiceCloudBackupV2';

import type { IOneKeyBackupProvider } from './backupProviders/IOneKeyBackupProvider';

type IMockFlowStartOptions = { detail?: string; trackUnfinished?: boolean };
type IMockFlowCall = {
  flow: IAvailabilityFlow;
  options: IMockFlowStartOptions | undefined;
  results: IAvailabilityFlowResult[];
};

const mockAvailability: {
  aggregator: AvailabilityAggregator | undefined;
  calls: IMockFlowCall[];
} = { aggregator: undefined, calls: [] };

// Flows are counted by a real aggregator instance owned by each test, so the
// assertions below pin the recorded series and failure keys, not just calls.
jest.mock('@onekeyhq/shared/src/request/availabilityAggregator', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/request/availabilityAggregator')
  >('@onekeyhq/shared/src/request/availabilityAggregator'),
  recordAvailabilityOutcome: () => undefined,
  startAvailabilityFlow: (
    flow: IAvailabilityFlow,
    options?: IMockFlowStartOptions,
  ): IAvailabilityFlowHandle => {
    const call: IMockFlowCall = { flow, options, results: [] };
    mockAvailability.calls.push(call);
    const handle = mockAvailability.aggregator?.startFlow(flow, options);
    return {
      finish: (result) => {
        call.results.push(result);
        handle?.finish(result);
      },
    };
  },
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthroughDecorator =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];
  return {
    backgroundClass: passthroughDecorator,
    backgroundMethod: passthroughDecorator,
    toastIfError: passthroughDecorator,
  };
});

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('./backupProviders/OneKeyBackupProvider', () => ({
  OneKeyBackupProvider: jest.fn(),
}));
jest.mock('../../states/jotai/atoms/cloudBackup', () => ({
  cloudBackupStatusAtom: {},
}));
jest.mock('../../utils/secretEncryptFormat', () => ({
  ...jest.requireActual<typeof import('../../utils/secretEncryptFormat')>(
    '../../utils/secretEncryptFormat',
  ),
  encryptAsyncWithFormat: async () => Buffer.from('synthetic-encrypted'),
}));

type IAvailabilityMemoryStorage = {
  budget?: IAvailabilityBudgetState;
  windows?: IAvailabilityWindowsState;
};

function createAggregator(memory: IAvailabilityMemoryStorage) {
  return new AvailabilityAggregator({
    now: () => 1000,
    createId: () => 'window',
    persistWindows: true,
    storage: {
      loadBudget: async () => memory.budget,
      saveBudget: async (state) => {
        memory.budget = state;
      },
      loadWindows: async () => memory.windows,
      saveWindows: async (state) => {
        memory.windows = state;
      },
    },
    canSend: async () => false,
    send: async () => undefined,
  });
}

let availabilityMemory: IAvailabilityMemoryStorage = {};

function resetAvailability() {
  availabilityMemory = {};
  mockAvailability.calls = [];
  mockAvailability.aggregator = createAggregator(availabilityMemory);
}

function readAvailability(
  aggregator: AvailabilityAggregator | undefined = mockAvailability.aggregator,
) {
  const state = aggregator?.getStateForTest();
  const series: Record<string, number> = {};
  Object.entries(state?.current?.series ?? {}).forEach(([key, value]) => {
    series[key] = value.count;
  });
  return {
    series,
    failures: { ...state?.current?.failures },
    inflight: { ...state?.inflight },
  };
}

/** Simulates the process being killed and the same runtime launching again. */
async function readAvailabilityAfterRelaunch() {
  await mockAvailability.aggregator?.settleForTest();
  const nextLaunch = createAggregator(availabilityMemory);
  await nextLaunch.settleForTest();
  return readAvailability(nextLaunch);
}

const transferData: IPrimeTransferData = {
  privateData: {
    credentials: {},
    decryptedCredentials: {},
    importedAccounts: {},
    watchingAccounts: {},
    wallets: {},
  },
  publicData: {
    dataTime: 1,
    totalWalletsCount: 0,
    totalAccountsCount: 0,
    walletDetails: [],
  },
  appVersion: 'test',
  isEmptyData: false,
  isWatchingOnly: false,
};

const { privateData: _privateData, ...publicFields } = transferData;
const encryptedPayload: IBackupDataEncryptedPayload = {
  ...publicFields,
  privateDataEncrypted: 'synthetic-encrypted',
};

const importError = {
  category: 'wallet',
  walletId: 'hd-1',
  accountId: 'hd-1--0',
  networkInfo: 'evm--1',
  error: 'synthetic import error',
};

type IPlatformFlags = {
  isNativeAndroid?: boolean;
  isNativeIOS?: boolean;
  isDesktopMac?: boolean;
};

function setPlatform(flags: IPlatformFlags) {
  jest.replaceProperty(
    platformEnv,
    'isNativeAndroid',
    flags.isNativeAndroid ?? false,
  );
  jest.replaceProperty(platformEnv, 'isNativeIOS', flags.isNativeIOS ?? false);
  jest.replaceProperty(
    platformEnv,
    'isDesktopMac',
    flags.isDesktopMac ?? false,
  );
}

async function waitUntil(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
  }
  throw new OneKeyLocalError('waitUntil: condition was not met');
}

function createNetworkError() {
  return Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
}

function createService() {
  jest.spyOn(ServiceCloudBackupV2.prototype, 'init').mockResolvedValue();
  jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

  const downloadData: IBackupCloudServerDownloadData = {
    content: 'synthetic-content',
    payload: encryptedPayload,
  };
  const provider = {
    checkAvailability: jest.fn(async () => undefined),
    getCloudAccountInfo: jest.fn(async () => ({
      userId: 'synthetic-user-id',
      userEmail: 'synthetic@example.com',
      providerType: ECloudBackupProviderType.GoogleDrive,
    })),
    backupData: jest.fn(
      async (): Promise<{ recordID: string; content: string }> => ({
        recordID: 'record-1',
        content: 'synthetic-content',
      }),
    ),
    downloadData: jest.fn(
      async (): Promise<IBackupCloudServerDownloadData | null> => downloadData,
    ),
    getAllBackups: jest.fn(async () => ({
      items: [{ recordID: 'record-1' }],
      total: 1,
    })),
    deleteBackup: jest.fn(async () => undefined),
  };
  const backgroundApi = {
    servicePrimeTransfer: {
      decryptTransferDataCredentials: jest.fn(async () => undefined),
      getSelectedTransferData: jest.fn(
        async (): Promise<{
          wallets: { credentialDecrypted?: string }[];
          importedAccounts: { credentialDecrypted?: string }[];
        }> => ({ wallets: [], importedAccounts: [] }),
      ),
      initImportProgress: jest.fn(async () => undefined),
      startImport: jest.fn(
        async (): Promise<{
          success: boolean;
          errorsInfo: (typeof importError)[];
          taskUUID?: string;
        }> => ({ success: true, errorsInfo: [], taskUUID: 'task-1' }),
      ),
      completeImportProgress: jest.fn(async () => undefined),
      resetImportProgress: jest.fn(async () => undefined),
    },
    servicePassword: {
      promptPasswordVerify: jest.fn(async () => ({
        password: 'synthetic-local-password',
      })),
    },
    serviceAccount: {
      updateHdWalletsBackedUpStatusForCloudBackup: jest.fn(
        async () => undefined,
      ),
    },
  };
  const service = new ServiceCloudBackupV2({ backgroundApi });
  service._backupProvider = provider as unknown as IOneKeyBackupProvider;
  jest
    .spyOn(service, 'restorePreparePrivateData')
    .mockResolvedValue(transferData.privateData);
  return { service, provider, backgroundApi };
}

describe('ServiceCloudBackupV2 availability flows', () => {
  beforeEach(() => {
    resetAvailability();
    setPlatform({ isNativeAndroid: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('backup', () => {
    it('counts a verified backup as ok and returns the provider result', async () => {
      const { service, provider } = createService();

      await expect(
        service.backup({ data: transferData, password: 'synthetic-password' }),
      ).resolves.toEqual({
        recordID: 'record-1',
        content: 'synthetic-content',
      });

      expect(provider.backupData).toHaveBeenCalledTimes(1);
      expect(mockAvailability.calls).toEqual([
        {
          flow: 'cloud_backup',
          options: { detail: 'google_drive', trackUnfinished: true },
          results: [{ status: 'ok' }],
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|cloud_backup|started': 1,
          'flow|cloud_backup|ok': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it('tracks the backup as in flight until it settles', async () => {
      const { service, provider } = createService();
      let rejectBackup: (error: unknown) => void = () => undefined;
      provider.backupData.mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            rejectBackup = reject;
          }),
      );

      const backupPromise = service.backup({
        data: transferData,
        password: 'synthetic-password',
      });
      expect(readAvailability().inflight).toEqual({ cloud_backup: 1 });

      await waitUntil(() => provider.backupData.mock.calls.length === 1);
      const networkError = createNetworkError();
      rejectBackup(networkError);

      await expect(backupPromise).rejects.toBe(networkError);
      expect(readAvailability().inflight).toEqual({});
    });

    it('reports a backup killed mid-flight as unfinished on the next launch', async () => {
      const { service, provider } = createService();
      provider.backupData.mockImplementation(
        () => new Promise(() => undefined),
      );

      void service.backup({
        data: transferData,
        password: 'synthetic-password',
      });
      await waitUntil(() => provider.backupData.mock.calls.length === 1);

      expect(await readAvailabilityAfterRelaunch()).toEqual({
        series: { 'flow|cloud_backup|unfinished': 1 },
        failures: {},
        inflight: {},
      });
    });

    it('classifies a provider network failure with the provider detail and rethrows it', async () => {
      const { service, provider } = createService();
      const networkError = createNetworkError();
      provider.backupData.mockRejectedValue(networkError);

      await expect(
        service.backup({ data: transferData, password: 'synthetic-password' }),
      ).rejects.toBe(networkError);

      expect(mockAvailability.calls[0].results).toEqual([
        { status: 'failed', errorCode: 'err_network', detail: 'google_drive' },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|cloud_backup|started': 1,
          'flow|cloud_backup|failed': 1,
        },
        failures: {
          'flow|cloud_backup|failed|google_drive|err_network': 1,
        },
        inflight: {},
      });
    });

    it('classifies a provider timeout as timeout', async () => {
      const { service, provider } = createService();
      const timeoutError = Object.assign(
        new Error('timeout of 30000ms exceeded'),
        { code: 'ECONNABORTED' },
      );
      provider.checkAvailability.mockRejectedValue(timeoutError);

      await expect(
        service.backup({ data: transferData, password: 'synthetic-password' }),
      ).rejects.toBe(timeoutError);

      expect(readAvailability()).toEqual({
        series: {
          'flow|cloud_backup|started': 1,
          'flow|cloud_backup|timeout': 1,
        },
        failures: {
          'flow|cloud_backup|timeout|google_drive|econnaborted': 1,
        },
        inflight: {},
      });
    });

    it('counts a failed upload verification as failed', async () => {
      const { service, provider } = createService();
      provider.downloadData.mockResolvedValue({
        content: 'different-content',
        payload: encryptedPayload,
      });

      const error = await service
        .backup({ data: transferData, password: 'synthetic-password' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OneKeyLocalError);
      expect((error as OneKeyLocalError).message).toBe(
        'Failed to backup data: content mismatch',
      );
      expect(provider.deleteBackup).toHaveBeenCalledWith({
        recordId: 'record-1',
        skipManifestUpdate: true,
      });
      const errorCode = getAvailabilityErrorCode(error);
      expect(mockAvailability.calls[0].results).toEqual([
        { status: 'failed', errorCode, detail: 'google_drive' },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|cloud_backup|started': 1,
          'flow|cloud_backup|failed': 1,
        },
        failures: {
          [`flow|cloud_backup|failed|google_drive|${errorCode}`]: 1,
        },
        inflight: {},
      });
    });
  });

  describe('restore', () => {
    it('counts a clean import as ok and returns the import result', async () => {
      const { service, backgroundApi } = createService();

      const result = await service.restore({
        payload: encryptedPayload,
        password: 'synthetic-password',
      });

      expect(result).toMatchObject({ success: true, errorsInfo: [] });
      expect(
        backgroundApi.servicePassword.promptPasswordVerify,
      ).not.toHaveBeenCalled();
      expect(mockAvailability.calls).toEqual([
        {
          flow: 'cloud_restore',
          options: { detail: 'google_drive', trackUnfinished: true },
          results: [{ status: 'ok' }],
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|cloud_restore|started': 1,
          'flow|cloud_restore|ok': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it.each([true, false])(
      'counts an import with errors as partial (success=%s)',
      async (success) => {
        const { service, backgroundApi } = createService();
        backgroundApi.servicePrimeTransfer.startImport.mockResolvedValue({
          success,
          errorsInfo: [importError],
          taskUUID: 'task-1',
        });

        const result = await service.restore({
          payload: encryptedPayload,
          password: 'synthetic-password',
        });

        expect(result).toMatchObject({ success, errorsInfo: [importError] });
        expect(mockAvailability.calls[0].results).toEqual([
          { status: 'partial', errorCode: 'partial_restore' },
        ]);
        // The partial result carries no detail of its own, so the failure
        // key falls back to the provider detail given at flow start.
        expect(readAvailability()).toEqual({
          series: {
            'flow|cloud_restore|started': 1,
            'flow|cloud_restore|partial': 1,
          },
          failures: {
            'flow|cloud_restore|partial|google_drive|partial_restore': 1,
          },
          inflight: {},
        });
      },
    );

    it('counts an unsuccessful import without errors as cancelled', async () => {
      const { service, backgroundApi } = createService();
      backgroundApi.servicePrimeTransfer.startImport.mockResolvedValue({
        success: false,
        errorsInfo: [],
        taskUUID: 'task-1',
      });

      const result = await service.restore({
        payload: encryptedPayload,
        password: 'synthetic-password',
      });

      expect(result).toMatchObject({ success: false, errorsInfo: [] });
      expect(mockAvailability.calls[0].results).toEqual([
        { status: 'cancelled' },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|cloud_restore|started': 1,
          'flow|cloud_restore|cancelled': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it('counts a dismissed local password prompt as cancelled', async () => {
      const { service, backgroundApi } = createService();
      backgroundApi.servicePrimeTransfer.getSelectedTransferData.mockResolvedValue(
        {
          wallets: [{ credentialDecrypted: 'synthetic-credential' }],
          importedAccounts: [],
        },
      );
      const cancelError = new PasswordPromptDialogCancel();
      backgroundApi.servicePassword.promptPasswordVerify.mockRejectedValue(
        cancelError,
      );

      await expect(
        service.restore({
          payload: encryptedPayload,
          password: 'synthetic-password',
        }),
      ).rejects.toBe(cancelError);

      expect(
        backgroundApi.servicePrimeTransfer.initImportProgress,
      ).not.toHaveBeenCalled();
      expect(mockAvailability.calls[0].results).toEqual([
        {
          status: 'cancelled',
          errorCode: getAvailabilityErrorCode(cancelError),
          detail: 'google_drive',
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|cloud_restore|started': 1,
          'flow|cloud_restore|cancelled': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it('counts an import exception as failed after resetting the import progress', async () => {
      const { service, backgroundApi } = createService();
      const networkError = createNetworkError();
      backgroundApi.servicePrimeTransfer.startImport.mockRejectedValue(
        networkError,
      );

      await expect(
        service.restore({
          payload: encryptedPayload,
          password: 'synthetic-password',
        }),
      ).rejects.toBe(networkError);

      expect(
        backgroundApi.servicePrimeTransfer.resetImportProgress,
      ).toHaveBeenCalledTimes(1);
      expect(readAvailability()).toEqual({
        series: {
          'flow|cloud_restore|started': 1,
          'flow|cloud_restore|failed': 1,
        },
        failures: {
          'flow|cloud_restore|failed|google_drive|err_network': 1,
        },
        inflight: {},
      });
    });

    it('counts a missing payload as failed', async () => {
      const { service, backgroundApi } = createService();

      const error = await service
        .restore({ payload: undefined, password: 'synthetic-password' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OneKeyLocalError);
      expect(
        backgroundApi.servicePrimeTransfer.getSelectedTransferData,
      ).not.toHaveBeenCalled();
      expect(readAvailability()).toEqual({
        series: {
          'flow|cloud_restore|started': 1,
          'flow|cloud_restore|failed': 1,
        },
        failures: {
          [`flow|cloud_restore|failed|google_drive|${getAvailabilityErrorCode(
            error,
          )}`]: 1,
        },
        inflight: {},
      });
    });

    it('reports a restore killed mid-import as unfinished on the next launch', async () => {
      const { service, backgroundApi } = createService();
      backgroundApi.servicePrimeTransfer.startImport.mockImplementation(
        () => new Promise(() => undefined),
      );

      void service.restore({
        payload: encryptedPayload,
        password: 'synthetic-password',
      });
      await waitUntil(
        () =>
          backgroundApi.servicePrimeTransfer.startImport.mock.calls.length ===
          1,
      );

      expect(await readAvailabilityAfterRelaunch()).toEqual({
        series: { 'flow|cloud_restore|unfinished': 1 },
        failures: {},
        inflight: {},
      });
    });

    it('tracks the restore as in flight until it settles', async () => {
      const { service, backgroundApi } = createService();
      let resolveImport: (value: {
        success: boolean;
        errorsInfo: (typeof importError)[];
        taskUUID?: string;
      }) => void = () => undefined;
      backgroundApi.servicePrimeTransfer.startImport.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveImport = resolve;
          }),
      );

      const restorePromise = service.restore({
        payload: encryptedPayload,
        password: 'synthetic-password',
      });
      expect(readAvailability().inflight).toEqual({ cloud_restore: 1 });

      await waitUntil(
        () =>
          backgroundApi.servicePrimeTransfer.startImport.mock.calls.length ===
          1,
      );
      resolveImport({ success: true, errorsInfo: [], taskUUID: 'task-1' });
      await restorePromise;

      expect(readAvailability().inflight).toEqual({});
    });
  });

  describe('provider detail', () => {
    it.each([
      ['Android', { isNativeAndroid: true }, 'google_drive'],
      ['iOS', { isNativeIOS: true }, 'icloud'],
      ['macOS desktop', { isDesktopMac: true }, 'icloud'],
      ['other platforms', {}, 'unsupported'],
    ] as [string, IPlatformFlags, string][])(
      'uses the %s cloud provider as the flow detail',
      async (_name, flags, detail) => {
        setPlatform(flags);
        const { service } = createService();

        await service.backup({
          data: transferData,
          password: 'synthetic-password',
        });
        await service.restore({
          payload: encryptedPayload,
          password: 'synthetic-password',
        });

        expect(
          mockAvailability.calls.map(({ flow, options }) => ({
            flow,
            options,
          })),
        ).toEqual([
          { flow: 'cloud_backup', options: { detail, trackUnfinished: true } },
          {
            flow: 'cloud_restore',
            options: { detail, trackUnfinished: true },
          },
        ]);
      },
    );
  });
});
