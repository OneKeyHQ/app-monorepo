/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import PageFirmwareUpdateInstallV2 from './PageFirmwareUpdateInstallV2';

let mockStep = 'updateDone';
let mockOnReallyLeave: (() => void | Promise<void>) | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Page: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EFirmwareUpdateSteps: {
    error: 'error',
    installing: 'installing',
    requestDeviceForSwitchFirmwareWebDevice:
      'requestDeviceForSwitchFirmwareWebDevice',
    requestDeviceInBootloaderForWebDevice:
      'requestDeviceInBootloaderForWebDevice',
    updateDone: 'updateDone',
    updateStart: 'updateStart',
  },
  useFirmwareUpdateStepInfoAtom: () => [
    {
      step: mockStep,
      payload: {
        needOnboarding: false,
      },
    },
  ],
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const mockExitUpdateWorkflow = jest.fn();
  const mockCancel = jest.fn();
  return {
    __esModule: true,
    mockCancel,
    mockExitUpdateWorkflow,
    default: {
      serviceFirmwareUpdate: {
        exitUpdateWorkflow: mockExitUpdateWorkflow,
      },
      serviceHardware: {
        cancel: mockCancel,
      },
    },
  };
});

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pop: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useAppRoute', () => ({
  useAppRoute: () => ({
    params: {
      result: {
        originalConnectId: 'PRO2_SERIAL',
      },
    },
  }),
}));

jest.mock('../components/FirmwareLatestVersionInstalled', () => ({
  FirmwareLatestVersionInstalled: () => null,
}));

jest.mock('../components/FirmwareUpdateExitPrevent', () => ({
  FirmwareUpdateExitPrevent: () => null,
  ForceExtensionUpdatingFromExpandTab: () => null,
}));

jest.mock('../components/FirmwareUpdatePageLayout', () => ({
  FirmwareUpdatePageFooter: () => null,
  FirmwareUpdatePageLayout: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('../componentsV2/FirmwareInstallingViewV2', () => ({
  FirmwareInstallingViewV2: () => null,
}));

jest.mock('../componentsV2/FirmwareUpdateAlertInfoMessage', () => ({
  FirmwareUpdateAlertInfoMessage: () => null,
}));

jest.mock('../hooks/useFirmwareUpdateActions', () => ({
  useFirmwareUpdateActions: () => ({
    closeUpdateModal: jest.fn(),
    restartOnboarding: jest.fn(),
  }),
}));

jest.mock('../hooks/useFirmwareUpdateHooks', () => ({
  useFirmwareUpdateWorkflowLifetime: ({
    onReallyLeave,
  }: {
    onReallyLeave?: () => void | Promise<void>;
  }) => {
    mockOnReallyLeave = onReallyLeave;
  },
}));

const { mockCancel, mockExitUpdateWorkflow } = jest.requireMock<{
  mockCancel: jest.Mock;
  mockExitUpdateWorkflow: jest.Mock;
}>('@onekeyhq/kit/src/background/instance/backgroundApiProxy');

async function runLeaveCleanup(step: string) {
  mockStep = step;
  const view = render(<PageFirmwareUpdateInstallV2 />);

  await act(async () => {
    await mockOnReallyLeave?.();
  });

  view.unmount();
}

describe('PageFirmwareUpdateInstallV2 leave cleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockOnReallyLeave = undefined;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('does not cancel a new device request after the update completed', async () => {
    await runLeaveCleanup('updateDone');

    expect(mockExitUpdateWorkflow).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('keeps device cancellation when leaving an unfinished update', async () => {
    await runLeaveCleanup('installing');

    expect(mockExitUpdateWorkflow).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith({
      connectId: 'PRO2_SERIAL',
      forceDeviceResetToHome: true,
    });
  });
});
