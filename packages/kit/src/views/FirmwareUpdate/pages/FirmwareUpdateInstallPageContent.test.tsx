/** @jest-environment jsdom */

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { act, render } from '@testing-library/react';

import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdateStepInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import { FirmwareUpdateExitPrevent } from '../components/FirmwareUpdateExitPrevent';
import { FirmwareUpdatePageFooter } from '../components/FirmwareUpdatePageLayout';
import { FirmwareUpdateInstallView } from '../componentsV2/FirmwareUpdateInstallView';

import { FirmwareUpdateInstallPageContent } from './FirmwareUpdateInstallPageContent';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceFirmwareUpdate: {
      clearHardwareUiStateBeforeStartUpdateWorkflow: jest.fn(),
      retryUpdateTask: jest.fn(),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EFirmwareUpdateSteps: {
    installing: 'installing',
    updateStart: 'updateStart',
    updateDone: 'updateDone',
    error: 'error',
  },
  firmwareUpdateStepInfoAtom: { get: jest.fn() },
  useFirmwareUpdateStepInfoAtom: jest.fn(() => [
    { step: 'installing', payload: {} },
    jest.fn(),
  ]),
  useFirmwareUpdateRetryAtom: jest.fn(),
}));
jest.mock('../hooks/useFirmwareUpdateHooks', () => ({
  useFirmwareUpdateWorkflowLifetime: jest.fn(),
}));
jest.mock('../hooks/useFirmwareUpdateActions', () => ({
  useFirmwareUpdateActions: () => ({
    closeUpdateModal: jest.fn(),
    restartOnboarding: jest.fn(),
  }),
}));
jest.mock('../hooks/useStartFirmwareUpdateWorkflow', () => ({
  useStartFirmwareUpdateWorkflow: () => ({ start: jest.fn() }),
}));
jest.mock('../components/FirmwareUpdateExitPrevent', () => ({
  FirmwareUpdateExitPrevent: jest.fn(() => null),
  ForceExtensionUpdatingFromExpandTab: () => null,
}));
jest.mock('../components/FirmwareUpdatePageLayout', () => ({
  FirmwareUpdatePageFooter: jest.fn(() => null),
  FirmwareUpdatePageLayout: () => null,
}));
jest.mock('../components/FirmwareUpdatePromptWebUsbDevice', () => ({
  useGrantWebUsbAccess: () => ({ grantAccess: jest.fn(), isConnecting: false }),
}));
jest.mock('../componentsV2/FirmwareUpdateInstallView', () => ({
  FirmwareUpdateInstallView: jest.fn(() => null),
}));
jest.mock('../componentsV2/firmwareUpdateErrorPresentation', () => ({
  resolveFirmwareUpdateErrorPresentation: () => ({
    sentence: 'Cancelled',
    action: { kind: 'retry' },
  }),
}));
jest.mock('../componentsV2/useFirmwareUpdateInstallState', () => ({
  useFirmwareUpdateInstallState: () => ({
    progress: 0,
    stage: 'waitingForDevice',
    previousStepInfo: { current: undefined },
  }),
}));
jest.mock('../componentsV2/useFirmwareUpdateItems', () => ({
  useFirmwareUpdateItems: () => ({ items: [], hideDebugInfo: true }),
}));
jest.mock('../utils', () => ({
  isFirmwareTypeSwitch: () => false,
  getTargetFirmwareTypeLabel: () => '',
}));

const {
  clearHardwareUiStateBeforeStartUpdateWorkflow: mockClearHardwareUi,
  retryUpdateTask: mockRetryUpdateTask,
} = jest.requireMock('../../../background/instance/backgroundApiProxy').default
  .serviceFirmwareUpdate as {
  clearHardwareUiStateBeforeStartUpdateWorkflow: jest.MockedFunction<
    () => Promise<void>
  >;
  retryUpdateTask: jest.MockedFunction<
    (params: {
      id: number;
      connectId: string | undefined;
      releaseResult: ICheckAllFirmwareReleaseResult | undefined;
    }) => Promise<void>
  >;
};

describe('FirmwareUpdateInstallPageContent device cancellation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearHardwareUi.mockResolvedValue(undefined);
    mockRetryUpdateTask.mockResolvedValue(undefined);
    jest
      .mocked(useFirmwareUpdateStepInfoAtom)
      .mockReturnValue([
        { step: EFirmwareUpdateSteps.installing, payload: {} },
        jest.fn(),
      ] as ReturnType<typeof useFirmwareUpdateStepInfoAtom>);
  });
  it('keeps cancellation and retry on the install page, including a second cancellation', async () => {
    const setStepInfo = jest.fn();
    jest
      .mocked(useFirmwareUpdateStepInfoAtom)
      .mockReturnValue([
        { step: EFirmwareUpdateSteps.installing, payload: {} },
        setStepInfo,
      ]);
    const retryInfo = {
      id: 1,
      error: { code: HardwareErrorCode.ActionCancelled },
    };
    jest
      .mocked(useFirmwareUpdateRetryAtom)
      .mockReturnValue([retryInfo, jest.fn()]);
    const result = {
      features: { protocol: 'V2' },
      updatingConnectId: 'pro2-test',
      updateInfos: {},
    } as ICheckAllFirmwareReleaseResult;
    const { rerender } = render(
      <FirmwareUpdateInstallPageContent result={result} />,
    );

    expect(
      jest.mocked(FirmwareUpdateInstallView).mock.lastCall?.[0],
    ).toMatchObject({ mode: 'error', errorSentence: 'Cancelled' });
    const footer = jest.mocked(FirmwareUpdatePageFooter).mock.lastCall?.[0];
    await act(async () => {
      await Promise.resolve(footer?.onConfirm?.(jest.fn(), jest.fn()));
    });
    expect(setStepInfo).toHaveBeenCalledWith({
      step: EFirmwareUpdateSteps.updateStart,
      payload: { startAtTime: expect.any(Number) },
    });
    expect(mockClearHardwareUi).toHaveBeenCalledTimes(1);
    expect(mockRetryUpdateTask).toHaveBeenCalledWith({
      id: retryInfo.id,
      connectId: result.updatingConnectId,
      releaseResult: result,
    });

    jest
      .mocked(useFirmwareUpdateStepInfoAtom)
      .mockReturnValue([
        { step: EFirmwareUpdateSteps.updateStart, payload: { startAtTime: 1 } },
        setStepInfo,
      ]);
    rerender(<FirmwareUpdateInstallPageContent result={result} />);
    expect(
      jest.mocked(FirmwareUpdateInstallView).mock.lastCall?.[0],
    ).toMatchObject({ mode: 'updating' });

    jest
      .mocked(useFirmwareUpdateRetryAtom)
      .mockReturnValue([undefined, jest.fn()]);
    jest
      .mocked(useFirmwareUpdateStepInfoAtom)
      .mockReturnValue([
        { step: EFirmwareUpdateSteps.installing, payload: {} },
        setStepInfo,
      ]);
    rerender(<FirmwareUpdateInstallPageContent result={result} />);
    expect(
      jest.mocked(FirmwareUpdateInstallView).mock.lastCall?.[0],
    ).toMatchObject({ mode: 'updating', stage: 'waitingForDevice' });

    jest
      .mocked(useFirmwareUpdateRetryAtom)
      .mockReturnValue([retryInfo, jest.fn()]);
    rerender(<FirmwareUpdateInstallPageContent result={result} />);
    expect(
      jest.mocked(FirmwareUpdateInstallView).mock.lastCall?.[0],
    ).toMatchObject({ mode: 'error', errorSentence: 'Cancelled' });
  });

  it('uses the default exit guard during transfer', () => {
    jest
      .mocked(useFirmwareUpdateRetryAtom)
      .mockReturnValue([undefined, jest.fn()]);
    const result = {
      features: { protocol: 'V2' },
      updateInfos: {},
    } as ICheckAllFirmwareReleaseResult;
    render(<FirmwareUpdateInstallPageContent result={result} />);
    const exitGuard = jest.mocked(FirmwareUpdateExitPrevent).mock.lastCall?.[0];
    expect(exitGuard).toBeDefined();
    expect(exitGuard?.preserveWorkflowOnCancel).not.toBe(true);
    expect(exitGuard?.shouldPreventRemove).not.toBe(false);
  });
});
