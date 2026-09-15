/*
yarn jest packages/kit-bg/src/services/ServiceHardware/ServiceHardware.availability.test.ts

Pins the availability counting of hardware device search and connect:
found/empty/failure classification, the `vendor:transport` detail and the
in-flight tracking that turns killed connects into `unfinished`.
*/
import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { HardwareConnectionManager } from './HardwareConnectionManager';
import ServiceHardware from './ServiceHardware';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { CoreApi, Features, SearchDevice } from '@onekeyfe/hd-core';

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

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    SyncDeviceLabelToWalletName: 'SyncDeviceLabelToWalletName',
    UpdateWalletAvatarByDeviceSerialNo: 'UpdateWalletAvatarByDeviceSerialNo',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isJest: true,
    isNative: false,
    isNativeAndroid: false,
    isSupportDesktopBle: false,
  },
}));

jest.mock('@onekeyhq/shared/src/hardware/blePermissions', () => ({
  checkBLEPermissions: jest.fn(async () => true),
  checkBLEState: jest.fn(async () => true),
}));

jest.mock('@onekeyhq/shared/src/hardware/instance', () => ({
  CoreSDKLoader: jest.fn(async () => ({})),
  getHardwareSDKInstance: jest.fn(),
  resetHardwareSDKInstance: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/deviceHomeScreenUtils', () => ({
  __esModule: true,
  DEFAULT_T1_HOME_SCREEN_INFORMATION: {},
  T1_HOME_SCREEN_DEFAULT_IMAGES: [],
  default: {},
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getAllDevices: jest.fn(async () => ({ devices: [] })),
    getAllWallets: jest.fn(async () => ({ wallets: [] })),
    getDeviceByQuery: jest.fn(async () => undefined),
    updateDeviceConnectProtocol: jest.fn(async () => undefined),
  },
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    appStatus: {
      getRawData: jest.fn(async () => ({
        hardwareConnectProtocolMigrationVersion: 1,
      })),
      setRawData: jest.fn(async () => undefined),
    },
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  EHardwareUiStateAction: jest.requireActual(
    '@onekeyhq/shared/types/hardwareUi',
  ).EHardwareUiStateAction,
  hardwareForceTransportAtom: {
    get: jest.fn(async () => ({ forceTransportType: undefined })),
  },
  hardwareUiStateAtom: {},
  hardwareUiStateCompletedAtom: {},
  settingsPersistAtom: {
    get: jest.fn(async () => ({})),
  },
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

async function waitUntil(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
  }
  throw new OneKeyLocalError('waitUntil: condition was not met');
}

const mutablePlatformEnv = platformEnv as unknown as {
  isNative: boolean;
  isNativeAndroid: boolean;
  isSupportDesktopBle: boolean;
};

type ISearchResponse = Awaited<ReturnType<CoreApi['searchDevices']>>;

const searchDevice = {
  connectId: 'USB_SERIAL',
  uuid: 'DEVICE_SERIAL',
  deviceId: 'DEVICE_ID',
  deviceType: 'pro',
  name: 'OneKey Pro',
} as unknown as SearchDevice;

function buildConnectDevice(vendor?: EHardwareVendor) {
  return {
    ...searchDevice,
    commType: 'webusb',
    connectProtocol: 'V1',
    ...(vendor ? { vendor } : {}),
  } as unknown as SearchDevice;
}

function createService() {
  const thirdPartySearchDevices = jest.fn(
    async (): Promise<ISearchResponse> => ({
      success: true,
      payload: [searchDevice],
    }),
  );
  const service = new ServiceHardware({
    backgroundApi: {
      serviceThirdPartyHardware: { searchDevices: thirdPartySearchDevices },
    } as unknown as IBackgroundApi,
  });
  const sdkSearchDevices = jest.fn(
    async (): Promise<ISearchResponse> => ({
      success: true,
      payload: [searchDevice],
    }),
  );
  const prepareHardwareTransport = jest
    .spyOn(service, 'prepareHardwareTransport')
    .mockResolvedValue(EHardwareTransportType.WEBUSB);
  jest.spyOn(service, 'getSDKInstance').mockResolvedValue({
    searchDevices: sdkSearchDevices,
  } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);
  jest.spyOn(service, 'getCompatibleConnectId').mockResolvedValue('USB_SERIAL');
  const connectDevice = jest
    .spyOn(service, 'connectDevice')
    .mockResolvedValue({ label: 'OneKey Pro' } as Features);
  return {
    service,
    sdkSearchDevices,
    thirdPartySearchDevices,
    prepareHardwareTransport,
    connectDevice,
  };
}

describe('ServiceHardware availability flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HardwareConnectionManager.resetInstance();
    mutablePlatformEnv.isNative = false;
    mutablePlatformEnv.isNativeAndroid = false;
    mutablePlatformEnv.isSupportDesktopBle = false;
    resetAvailability();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('searchDevices', () => {
    it('counts a non-empty result as found with the vendor and requested transport', async () => {
      const { service, sdkSearchDevices } = createService();
      const response: ISearchResponse = {
        success: true,
        payload: [searchDevice],
      };
      sdkSearchDevices.mockResolvedValue(response);

      await expect(
        service.searchDevices({ transportType: 'usb' }),
      ).resolves.toBe(response);

      expect(mockAvailability.calls).toEqual([
        {
          flow: 'hw_search',
          options: { detail: 'onekey:usb', trackUnfinished: undefined },
          results: [{ status: 'found', detail: 'onekey:usb' }],
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|hw_search|started': 1,
          'flow|hw_search|found': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it('counts an empty result as empty and defaults to onekey:auto', async () => {
      const { service, sdkSearchDevices } = createService();
      const response: ISearchResponse = { success: true, payload: [] };
      sdkSearchDevices.mockResolvedValue(response);

      await expect(service.searchDevices()).resolves.toBe(response);

      expect(mockAvailability.calls[0].results).toEqual([
        { status: 'empty', detail: 'onekey:auto' },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|hw_search|started': 1,
          'flow|hw_search|empty': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it('classifies an unsuccessful SDK payload by its code without throwing', async () => {
      const { service, sdkSearchDevices } = createService();
      const response: ISearchResponse = {
        success: false,
        payload: {
          error: 'Device not found',
          code: HardwareErrorCode.DeviceNotFound,
        },
      };
      sdkSearchDevices.mockResolvedValue(response);

      await expect(
        service.searchDevices({ transportType: 'ble' }),
      ).resolves.toBe(response);

      expect(mockAvailability.calls[0].results).toEqual([
        {
          status: 'failed',
          errorCode: String(HardwareErrorCode.DeviceNotFound),
          detail: 'onekey:ble',
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|hw_search|started': 1,
          'flow|hw_search|failed': 1,
        },
        failures: {
          [`flow|hw_search|failed|onekey:ble|${HardwareErrorCode.DeviceNotFound}`]: 1,
        },
        inflight: {},
      });
    });

    it('counts an unsuccessful payload with a cancel code as cancelled', async () => {
      const { service, sdkSearchDevices } = createService();
      sdkSearchDevices.mockResolvedValue({
        success: false,
        payload: {
          error: 'Action cancelled',
          code: HardwareErrorCode.ActionCancelled,
        },
      });

      await service.searchDevices();

      expect(readAvailability()).toEqual({
        series: {
          'flow|hw_search|started': 1,
          'flow|hw_search|cancelled': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it('uses the third-party vendor in the detail', async () => {
      const { service, thirdPartySearchDevices, sdkSearchDevices } =
        createService();
      thirdPartySearchDevices.mockResolvedValue({ success: true, payload: [] });

      await service.searchDevices({
        vendor: EHardwareVendor.trezor,
        transportType: 'ble',
      });

      expect(sdkSearchDevices).not.toHaveBeenCalled();
      expect(mockAvailability.calls[0]).toEqual({
        flow: 'hw_search',
        options: { detail: 'trezor:ble', trackUnfinished: undefined },
        results: [{ status: 'empty', detail: 'trezor:ble' }],
      });
    });

    it('counts a thrown search error as failed and rethrows it', async () => {
      const { service, prepareHardwareTransport } = createService();
      const error = Object.assign(new Error('transport unavailable'), {
        code: 'ERR_TRANSPORT',
      });
      prepareHardwareTransport.mockRejectedValue(error);

      await expect(
        service.searchDevices({ transportType: 'usb' }),
      ).rejects.toBe(error);

      expect(readAvailability()).toEqual({
        series: {
          'flow|hw_search|started': 1,
          'flow|hw_search|failed': 1,
        },
        failures: {
          'flow|hw_search|failed|onekey:usb|err_transport': 1,
        },
        inflight: {},
      });
      await expect(service.isDeviceSearchInProgress()).resolves.toBe(false);
    });
  });

  describe('connect', () => {
    it('counts returned features as ok and reflects the transport type in the detail', async () => {
      const { service, connectDevice } = createService();
      const features = { label: 'OneKey Pro' } as Features;
      connectDevice.mockResolvedValue(features);

      await expect(
        service.connect({
          device: buildConnectDevice(),
          hardwareTransportType: EHardwareTransportType.DesktopWebBle,
        }),
      ).resolves.toBe(features);

      expect(mockAvailability.calls).toEqual([
        {
          flow: 'hw_connect',
          options: { detail: 'onekey:desktop_web_ble', trackUnfinished: true },
          results: [{ status: 'ok', detail: 'onekey:desktop_web_ble' }],
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|hw_connect|started': 1,
          'flow|hw_connect|ok': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it('counts an empty connect result as failed with empty_result', async () => {
      const { service, connectDevice } = createService();
      connectDevice.mockResolvedValue(undefined as unknown as Features);

      await expect(
        service.connect({ device: buildConnectDevice() }),
      ).resolves.toBeUndefined();

      expect(mockAvailability.calls[0].results).toEqual([
        { status: 'failed', errorCode: 'empty_result', detail: 'onekey:auto' },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|hw_connect|started': 1,
          'flow|hw_connect|failed': 1,
        },
        failures: {
          'flow|hw_connect|failed|onekey:auto|empty_result': 1,
        },
        inflight: {},
      });
    });

    it('counts a native connect error swallowed by the reconnect handler as empty_result', async () => {
      mutablePlatformEnv.isNative = true;
      const { service, connectDevice } = createService();
      connectDevice.mockRejectedValue(new Error('peer removed pairing'));

      await expect(
        service.connect({
          device: buildConnectDevice(),
          hardwareTransportType: EHardwareTransportType.BLE,
        }),
      ).resolves.toBeUndefined();

      expect(readAvailability().failures).toEqual({
        'flow|hw_connect|failed|onekey:ble|empty_result': 1,
      });
    });

    it('classifies a connect failure and rethrows it', async () => {
      const { service, connectDevice } = createService();
      const error = new Error('WebUSB reconnect failed');
      connectDevice.mockRejectedValue(error);

      await expect(
        service.connect({
          device: buildConnectDevice(),
          hardwareTransportType: EHardwareTransportType.WEBUSB,
        }),
      ).rejects.toBe(error);

      expect(mockAvailability.calls[0].results).toEqual([
        {
          status: 'failed',
          errorCode: getAvailabilityErrorCode(error),
          detail: 'onekey:webusb',
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|hw_connect|started': 1,
          'flow|hw_connect|failed': 1,
        },
        failures: {
          [`flow|hw_connect|failed|onekey:webusb|${getAvailabilityErrorCode(
            error,
          )}`]: 1,
        },
        inflight: {},
      });
    });

    it('counts a hardware-side cancellation as cancelled', async () => {
      const { service, connectDevice } = createService();
      const error = Object.assign(new Error('Action cancelled'), {
        code: HardwareErrorCode.ActionCancelled,
      });
      connectDevice.mockRejectedValue(error);

      await expect(
        service.connect({ device: buildConnectDevice() }),
      ).rejects.toBe(error);

      expect(readAvailability()).toEqual({
        series: {
          'flow|hw_connect|started': 1,
          'flow|hw_connect|cancelled': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it('uses the device vendor in the detail when a third-party device is rejected', async () => {
      const { service, connectDevice } = createService();

      await expect(
        service.connect({ device: buildConnectDevice(EHardwareVendor.ledger) }),
      ).rejects.toBeInstanceOf(OneKeyLocalError);

      expect(connectDevice).not.toHaveBeenCalled();
      expect(mockAvailability.calls[0].options).toEqual({
        detail: 'ledger:auto',
        trackUnfinished: true,
      });
      expect(readAvailability().series).toEqual({
        'flow|hw_connect|started': 1,
        'flow|hw_connect|failed': 1,
      });
    });

    it('tracks the connect as in flight and reports a killed connect as unfinished', async () => {
      const { service, connectDevice } = createService();
      connectDevice.mockImplementation(() => new Promise(() => undefined));

      void service.connect({ device: buildConnectDevice() });
      expect(readAvailability().inflight).toEqual({ hw_connect: 1 });
      await waitUntil(() => connectDevice.mock.calls.length === 1);

      expect(await readAvailabilityAfterRelaunch()).toEqual({
        series: { 'flow|hw_connect|unfinished': 1 },
        failures: {},
        inflight: {},
      });
    });
  });
});
