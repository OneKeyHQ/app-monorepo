/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

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
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: { connect: (p: unknown) => mockConnect(p) },
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
