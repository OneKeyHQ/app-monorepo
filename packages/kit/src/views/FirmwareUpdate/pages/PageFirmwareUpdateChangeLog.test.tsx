/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EFirmwareUpdateSteps } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import {
  EHardwareCallContext,
  type ICheckAllFirmwareReleaseResult,
} from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import PageFirmwareUpdateChangeLog from './PageFirmwareUpdateChangeLog';

let mockConnectId: string | undefined;
const mockSetStepInfo = jest.fn();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: { resolveHardwareTransport: jest.fn() },
    serviceFirmwareUpdate: { checkAllFirmwareRelease: jest.fn() },
  },
}));
jest.mock('../../../hooks/useAppRoute', () => ({
  useAppRoute: () => ({ params: { connectId: mockConnectId } }),
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(() => ({ isLoading: true })),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EFirmwareUpdateSteps: {
    init: 'init',
    showChangeLog: 'showChangeLog',
    checkReleaseError: 'checkReleaseError',
  },
  useFirmwareUpdateStepInfoAtom: () => [{ step: 'init' }, mockSetStepInfo],
  useFirmwareUpdateRetryAtom: () => [undefined],
}));
jest.mock('@onekeyhq/shared/src/errors/utils/firmwareUpdateErrorUtils', () => ({
  toUserFacingFirmwareUpdateError: (error: unknown) => error,
}));
jest.mock('../hooks/useFirmwareUpdateHooks', () => ({
  useFirmwareUpdateWorkflowLifetime: jest.fn(),
}));
jest.mock('../components/FirmwareChangeLogView', () => ({}));
jest.mock('../components/FirmwareCheckingLoading', () => ({}));
jest.mock('../components/FirmwareLatestVersionInstalled', () => ({}));
jest.mock('../components/FirmwareUpdateErrors', () => ({}));
jest.mock('../components/FirmwareUpdateExitPrevent', () => ({}));
jest.mock('../components/FirmwareUpdatePageLayout', () => ({}));
jest.mock('../components/FirmwareUpdateWarningMessage', () => ({}));

describe('firmware changelog entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { connectId: undefined, transportType: EHardwareTransportType.WEBUSB },
    { connectId: '', transportType: EHardwareTransportType.WEBUSB },
    {
      connectId: 'DEVICE_BLE',
      transportType: EHardwareTransportType.DesktopWebBle,
    },
    { connectId: 'DEVICE_USB', transportType: EHardwareTransportType.WEBUSB },
  ])(
    'checks releases for connectId=$connectId over $transportType',
    async ({ connectId, transportType }) => {
      mockConnectId = connectId;
      const release = { hasUpgrade: true } as ICheckAllFirmwareReleaseResult;
      jest
        .spyOn(backgroundApiProxy.serviceHardware, 'resolveHardwareTransport')
        .mockImplementation(async (params) => {
          // Match the existing resolver contract for anonymous USB discovery.
          if (
            !params.connectId &&
            params.hardwareCallContext !== EHardwareCallContext.UPDATE_FIRMWARE
          ) {
            throw new OneKeyLocalError('connectId is required');
          }
          return {
            connectId: params.connectId || '',
            transportType:
              params.hardwareCallContext ===
              EHardwareCallContext.UPDATE_FIRMWARE
                ? EHardwareTransportType.WEBUSB
                : transportType,
          };
        });
      const checkAllFirmwareRelease = jest
        .spyOn(
          backgroundApiProxy.serviceFirmwareUpdate,
          'checkAllFirmwareRelease',
        )
        .mockResolvedValue(release);

      const { unmount } = renderHook(PageFirmwareUpdateChangeLog);
      const [checkRelease] = jest.mocked(usePromiseResult).mock.calls[0];
      await act(async () => {
        expect(await checkRelease()).toBe(release);
      });

      expect(checkAllFirmwareRelease).toHaveBeenCalledWith({
        connectId: connectId || '',
        firmwareType: undefined,
        baseReleaseInfoCache: undefined,
        resolvedTransportType: transportType,
      });
      expect(mockSetStepInfo).toHaveBeenCalledWith({
        step: EFirmwareUpdateSteps.showChangeLog,
        payload: undefined,
      });
      unmount();
    },
  );
});
