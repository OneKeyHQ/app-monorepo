/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { act, render } from '@testing-library/react';

import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';

import { HardwareCloudSyncDevicePicker } from './HardwareCloudSyncDevicePicker';

type IItem = { device?: { connectId?: string; commType?: string } };
type IChannelsProps = {
  deviceTypeItems: string[];
  variant?: string;
  connectDevice: (item: IItem) => Promise<void>;
  onWebDeviceConnected: (deviceData: IItem) => Promise<void>;
};
let mockChannelsProps: IChannelsProps | undefined;
const mockConnect = jest.fn(async (_params: unknown) => ({}));
const mockBeginBurst = jest.fn(async (_params: unknown) => ({
  token: 41,
  burstId: 51,
}));
const mockEndBurst = jest.fn(async (_params: unknown) => {});

jest.mock('@onekeyhq/components', () => ({
  YStack: ({ children }: { children?: ReactNode }) => children,
}));
// Scanning, the USB chooser and Bluetooth checks belong to onboarding's
// component; here only what a connected device leads to is checked.
jest.mock(
  '@onekeyhq/kit/src/views/Onboardingv2/pages/ConnectYourDevice',
  () => ({
    ConnectDeviceChannels: (props: IChannelsProps) => {
      mockChannelsProps = props;
      return null;
    },
  }),
);
jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {
    isBluetoothSearchDevice: (device: { commType?: string }) =>
      device.commType === 'ble',
    getDeviceColorFromSearchDevice: () => 'black',
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: { connect: (p: unknown) => mockConnect(p) },
    serviceHardwareUI: {
      deviceStageBeginBurst: (p: unknown) => mockBeginBurst(p),
      deviceStageEndBurst: (p: unknown) => mockEndBurst(p),
    },
  },
}));

function renderPicker() {
  const onPick = jest.fn();
  render(<HardwareCloudSyncDevicePicker onPick={onPick} />);
  expect(mockChannelsProps).toBeDefined();
  return { onPick, props: mockChannelsProps as IChannelsProps };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockChannelsProps = undefined;
});

test('reuses the onboarding channels for any model, laid out for a dialog', () => {
  const { props } = renderPicker();
  expect(props.deviceTypeItems).toEqual([]);
  expect(props.variant).toBe('dialog');
});

test('a scanned device is connected, then its connectId is handed back', async () => {
  const { onPick, props } = renderPicker();
  const device = { connectId: 'connect-A', commType: 'ble' };
  await act(async () => props.connectDevice({ device }));
  expect(mockConnect).toHaveBeenCalledWith(
    expect.objectContaining({ device, forceProtocolDetection: true }),
  );
  expect(mockConnect.mock.invocationCallOrder[0]).toBeLessThan(
    onPick.mock.invocationCallOrder[0],
  );
  expect(onPick).toHaveBeenCalledWith('connect-A');
});

test.each([false, true])(
  'USB-blocked Bluetooth errors reach the shared hardware error flow and permit retry (autoToast=%s)',
  async (autoToast) => {
    const { onPick, props } = renderPicker();
    const device = { connectId: 'connect-A', commType: 'ble' };
    const failure = convertDeviceError({
      code: HardwareErrorCode.BleUnavailableWhileUsbConnected,
    });
    failure.autoToast = autoToast;
    mockConnect.mockRejectedValueOnce(failure);

    await act(async () => {
      await expect(props.connectDevice({ device })).resolves.toBeUndefined();
    });

    expect(onPick).not.toHaveBeenCalled();
    expect(mockEndBurst).toHaveBeenCalledWith({
      token: 41,
      doneI18n: undefined,
      error: expect.objectContaining({
        code: HardwareErrorCode.BleUnavailableWhileUsbConnected,
        message: failure.message,
        key: failure.key,
        $isHardwareError: true,
        autoToast,
      }),
    });
    expect(mockBeginBurst.mock.invocationCallOrder[0]).toBeLessThan(
      mockConnect.mock.invocationCallOrder[0],
    );
    expect(failure.autoToast).toBe(autoToast);

    await act(async () => props.connectDevice({ device }));
    expect(mockConnect).toHaveBeenCalledTimes(2);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(mockEndBurst.mock.invocationCallOrder[1]).toBeLessThan(
      onPick.mock.invocationCallOrder[0],
    );
  },
);

test('unexpected connection errors remain on the existing caller error path', async () => {
  const { onPick, props } = renderPicker();
  const failure = new Error('Unexpected connection failure');
  mockConnect.mockRejectedValueOnce(failure);

  await act(async () => {
    await expect(
      props.connectDevice({
        device: { connectId: 'connect-A', commType: 'ble' },
      }),
    ).rejects.toBe(failure);
  });

  expect(onPick).not.toHaveBeenCalled();
  expect(mockEndBurst).toHaveBeenCalledWith({
    token: 41,
    error: undefined,
    doneI18n: undefined,
  });
});

test('a failure after picking is not reported as a connection failure', async () => {
  const failure = new Error('Cloud setup failed');
  const onPick = jest.fn(async () => {
    throw failure;
  });
  render(<HardwareCloudSyncDevicePicker onPick={onPick} />);

  await act(async () => {
    await expect(
      mockChannelsProps?.connectDevice({
        device: { connectId: 'connect-A', commType: 'ble' },
      }),
    ).rejects.toBe(failure);
  });

  expect(mockEndBurst).toHaveBeenCalledWith({
    token: 41,
    error: undefined,
    doneI18n: undefined,
  });
});

test('a device granted in the USB chooser is handed back as is', async () => {
  const { onPick, props } = renderPicker();
  await act(async () =>
    props.onWebDeviceConnected({ device: { connectId: 'web-connect-A' } }),
  );
  expect(mockConnect).not.toHaveBeenCalled();
  expect(onPick).toHaveBeenCalledWith('web-connect-A');
});

test('a device without a connectId is ignored', async () => {
  const { onPick, props } = renderPicker();
  await act(async () => props.connectDevice({ device: {} }));
  await act(async () => props.onWebDeviceConnected({ device: {} }));
  expect(mockConnect).not.toHaveBeenCalled();
  expect(onPick).not.toHaveBeenCalled();
});
