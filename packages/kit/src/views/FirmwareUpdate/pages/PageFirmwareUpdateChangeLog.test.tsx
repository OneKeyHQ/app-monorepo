/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { act, render, screen } from '@testing-library/react';

import { EFirmwareUpdateSteps } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ECustomOneKeyHardwareError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import PageFirmwareUpdateChangeLog from './PageFirmwareUpdateChangeLog';

type ITransport = { connectId: string; transportType: EHardwareTransportType };
const mockPreflight = jest.fn<Promise<ITransport>, [unknown]>();
const mockResolveTransport = jest.fn<Promise<ITransport>, [unknown]>();
const mockCheckRelease = jest.fn<
  Promise<ICheckAllFirmwareReleaseResult | undefined>,
  [unknown]
>();
const mockRun = jest.fn();
const mockSetStepInfo = jest.fn();
let mockCheck: () => Promise<ICheckAllFirmwareReleaseResult | undefined>;
let mockIsLoading: boolean | undefined;
let mockStep = { step: 'init', payload: {} };

jest.mock('@react-navigation/core', () => ({ useIsFocused: () => true }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: true },
}));
jest.mock('@onekeyhq/components', () => ({
  Page: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../../hooks/useAppRoute', () => ({
  useAppRoute: () => ({ params: { connectId: 'SELECTED_DEVICE' } }),
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: (
    check: () => Promise<ICheckAllFirmwareReleaseResult | undefined>,
  ) => {
    mockCheck = check;
    return { result: undefined, run: mockRun, isLoading: mockIsLoading };
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EFirmwareUpdateSteps: {
    checkReleaseError: 'checkReleaseError',
    showChangeLog: 'showChangeLog',
  },
  useFirmwareUpdateStepInfoAtom: () => [mockStep, mockSetStepInfo],
  useFirmwareUpdateRetryAtom: () => [undefined],
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      checkDeviceReachableForFirmwareUpdate: (params: unknown) =>
        mockPreflight(params),
      resolveHardwareTransport: (params: unknown) =>
        mockResolveTransport(params),
    },
    serviceFirmwareUpdate: {
      checkAllFirmwareRelease: (params: unknown) => mockCheckRelease(params),
    },
  },
}));
jest.mock('../hooks/useFirmwareUpdateHooks', () => ({
  useFirmwareUpdateWorkflowLifetime: jest.fn(),
}));
jest.mock('../components/FirmwareUpdatePageLayout', () => ({
  FirmwareUpdatePageLayout: ({ children }: { children: ReactNode }) => children,
  FirmwareUpdatePageHeaderTitle: () => null,
}));
jest.mock('../components/FirmwareUpdateExitPrevent', () => ({
  FirmwareUpdateExitPrevent: () => null,
  ForceExtensionUpdatingFromExpandTab: () => null,
}));
jest.mock('../components/FirmwareCheckingLoading', () => ({
  FirmwareCheckingLoading: () => <div>Checking firmware</div>,
}));
jest.mock('../components/FirmwareLatestVersionInstalled', () => ({
  FirmwareLatestVersionInstalled: () => <div>Latest installed</div>,
}));
jest.mock('../components/FirmwareChangeLogView', () => ({
  FirmwareChangeLogView: () => null,
}));
jest.mock('../components/FirmwareUpdateWarningMessage', () => ({
  FirmwareUpdateWarningMessage: () => null,
}));
jest.mock('../components/FirmwareUpdateErrors', () => ({
  FirmwareUpdateErrors: {
    WorkflowErrors: ({ onRetry }: { onRetry: () => void }) => (
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    ),
  },
}));

describe('desktop firmware checking entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoading = undefined;
    mockStep = { step: 'init', payload: {} };
  });

  it('shows checking on the first render before the request starts', () => {
    render(<PageFirmwareUpdateChangeLog />);
    expect(screen.getByText('Checking firmware')).toBeTruthy();
    expect(screen.queryByText('Latest installed')).toBeNull();
  });

  it('checks once inside the page and passes the verified transport to the release check', async () => {
    let resolvePreflight: (value: {
      connectId: string;
      transportType: EHardwareTransportType;
    }) => void = () => {};
    mockPreflight.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePreflight = resolve;
      }),
    );
    render(<PageFirmwareUpdateChangeLog />);
    const checking = mockCheck();

    expect(screen.getByText('Checking firmware')).toBeTruthy();
    expect(mockCheckRelease).not.toHaveBeenCalled();
    await act(async () => {
      resolvePreflight({
        connectId: 'VERIFIED_USB',
        transportType: EHardwareTransportType.WEBUSB,
      });
      await checking;
    });

    expect(mockPreflight).toHaveBeenCalledTimes(1);
    expect(mockPreflight).toHaveBeenCalledWith({
      connectId: 'SELECTED_DEVICE',
    });
    expect(mockResolveTransport).not.toHaveBeenCalled();
    expect(mockCheckRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        connectId: 'VERIFIED_USB',
        resolvedTransportType: EHardwareTransportType.WEBUSB,
      }),
    );
  });

  it.each([
    ECustomOneKeyHardwareError.FirmwareUpdateRequiresUsbTransport,
    HardwareErrorCode.FirmwareUpdateLimitOneDevice,
    HardwareErrorCode.DeviceCheckDeviceIdError,
  ])(
    'blocks the release check and permits retry for rejection %s',
    async (code) => {
      mockPreflight.mockRejectedValueOnce({ $isHardwareError: true, code });
      const view = render(<PageFirmwareUpdateChangeLog />);
      await act(async () => {
        await mockCheck();
      });
      expect(mockCheckRelease).not.toHaveBeenCalled();
      expect(mockSetStepInfo).toHaveBeenCalledWith({
        step: EFirmwareUpdateSteps.checkReleaseError,
        payload: { error: expect.objectContaining({ code }) },
      });

      mockIsLoading = false;
      mockStep = mockSetStepInfo.mock.calls[0][0];
      view.rerender(<PageFirmwareUpdateChangeLog />);
      screen.getByRole('button', { name: 'Retry' }).click();
      expect(mockRun).toHaveBeenCalledTimes(1);
    },
  );
});
