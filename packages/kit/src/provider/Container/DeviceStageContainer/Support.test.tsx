/** @jest-environment jsdom */

import type { ComponentProps } from 'react';

import { DeviceStageContainer } from '.';

import { act, render } from '@testing-library/react';

import type { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

let mockNative = false;
let mockStageProps: ComponentProps<typeof DeviceStage>;
const mockClose = jest.fn(async (_params: unknown) => {});
const mockEmit = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  DeviceStage: (props: ComponentProps<typeof DeviceStage>) => {
    mockStageProps = props;
    return null;
  },
  useDeviceStageEscapeOwner: jest.fn(),
  useDeviceStageExitPolicy: () => ({
    closable: true,
    exitAllowed: true,
    stalled: false,
    clocksRef: { current: { appearedAt: 0, waitStartedAt: 0 } },
  }),
  useBackHandler: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardwareUI: {
      deviceStageUserClose: (params: unknown) => mockClose(params),
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDeviceStageAtom: () => [
    { step: 'deviceNotFound', connectId: 'test-device' },
  ],
  useDevSettingsPersistAtom: () => [{ enabled: false }],
  useSettingsPersistAtom: () => [{}, jest.fn()],
}));
jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  HARDWARE_TROUBLESHOOTING_URL: 'https://help.onekey.so/',
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { DeviceStageAuthAction: 'auth-action' },
  appEventBus: {
    emit: (...args: unknown[]) => {
      mockEmit(...args);
    },
  },
}));
jest.mock('@onekeyhq/shared/src/hardware/deviceStageOwnership', () => ({
  isDeviceStageMachineWaitStep: () => false,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { hardware: { connection: { deviceStageClosed: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/logger/solanaTxDiagnostics', () => ({
  logSolanaTxDiagnostic: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({
  showIntercom: jest.fn(async () => {}),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockNative;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/hardwareDeviceTypes', () => ({
  isProtocolV2ProductType: () => false,
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock(
  '../FullWindowOverlayContainer/HardwareStageOverlayContainer',
  () => ({ registerHardwareStageBackHandler: jest.fn() }),
);
jest.mock('../ThirdPartyHardwareUiStateContainer/utils', () => ({
  buildThirdPartyHardwareUiResponse: jest.fn(),
}));
jest.mock('./DeviceStageQrScanner', () => ({
  DeviceStageQrScanner: () => null,
}));

beforeEach(() => jest.clearAllMocks());

describe.each([false, true])('support entry with native=%s', (native) => {
  beforeEach(() => {
    mockNative = native;
  });

  it('closes the hardware overlay when opening support from the connection error', () => {
    render(<DeviceStageContainer />);
    act(() => mockStageProps.onDeviceNotFoundSupport?.());
    expect(showIntercom).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledWith({ connectId: 'test-device' });
  });

  it('closes the overlay after forwarding the authenticity support action', () => {
    render(<DeviceStageContainer />);
    act(() => mockStageProps.onAuthSupport?.());
    expect(mockEmit).toHaveBeenCalledWith('auth-action', {
      action: 'support',
    });
    expect(mockClose).toHaveBeenCalledWith({ connectId: 'test-device' });
    expect(mockEmit.mock.invocationCallOrder[0]).toBeLessThan(
      mockClose.mock.invocationCallOrder[0],
    );
  });

  it('preserves the platform-specific exit for external troubleshooting', () => {
    render(<DeviceStageContainer />);
    act(() => mockStageProps.onDeviceNotFoundTroubleshoot?.());
    expect(openUrlExternal).toHaveBeenCalledWith('https://help.onekey.so/');
    expect(mockClose).toHaveBeenCalledTimes(native ? 1 : 0);
  });
});
