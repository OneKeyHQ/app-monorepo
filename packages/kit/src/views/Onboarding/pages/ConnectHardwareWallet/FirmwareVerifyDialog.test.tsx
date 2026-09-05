/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    messages: {},
  }),
}));

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Div = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', undefined, children);
  const Button = ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => React.createElement('button', { onClick: onPress }, children);

  return {
    Anchor: Div,
    Button,
    Dialog: {
      show: jest.fn(),
      Description: Div,
      Header: Div,
      Icon: Div,
      Title: Div,
    },
    HeightTransition: Div,
    Icon: Div,
    SizableText: Div,
    Spinner: Div,
    Stack: Div,
    XStack: Div,
    YStack: Div,
    useDialogInstance: jest.fn(),
  };
});

jest.mock('@onekeyhq/kit/src/components/HyperlinkText', () => ({
  HyperlinkText: 'HyperlinkText',
}));

jest.mock('@onekeyhq/kit/src/components/MultipleClickStack', () => ({
  MultipleClickStack: 'MultipleClickStack',
}));

const mockCloseHardwareUiStateDialog = jest.fn(
  async (_params: unknown): Promise<void> => undefined,
);
const mockShouldAuthenticateFirmwareByHash = jest.fn(
  async (_params: unknown): Promise<boolean> => true,
);
const mockFirmwareAuthenticate = jest.fn<Promise<unknown>, [unknown]>();
const mockGetFirmwareVerificationFeatures = jest.fn<
  Promise<unknown>,
  [unknown]
>();
const mockVerifyFirmwareHash = jest.fn<Promise<unknown>, [unknown]>();
const mockDeviceStageNoteAuthStep = jest.fn(
  async (_params: unknown): Promise<void> => undefined,
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      firmwareAuthenticate: (params: unknown) =>
        mockFirmwareAuthenticate(params),
      getFirmwareVerificationFeatures: (params: unknown) =>
        mockGetFirmwareVerificationFeatures(params),
      verifyFirmwareHash: (params: unknown) => mockVerifyFirmwareHash(params),
      shouldAuthenticateFirmwareByHash: (params: unknown) =>
        mockShouldAuthenticateFirmwareByHash(params),
    },
    serviceHardwareUI: {
      closeHardwareUiStateDialog: (params: unknown) =>
        mockCloseHardwareUiStateDialog(params),
      deviceStageJoinBurst: jest.fn(async () => undefined),
      deviceStageLeaveBurst: jest.fn(async () => undefined),
      deviceStageNoteAuthStep: (params: unknown) =>
        mockDeviceStageNoteAuthStep(params),
    },
  },
}));

let legacyHardwareUiActive = false;
jest.mock('@onekeyhq/shared/src/hardware/deviceStageOwnership', () => ({
  isLegacyHardwareUiActive: () => legacyHardwareUiActive,
}));

const mockRunDeviceStageFirmwareVerify = jest.fn(
  async (
    _params: unknown,
  ): Promise<{ checked: boolean; closed?: boolean }> => ({
    checked: true,
  }),
);

jest.mock('./useDeviceStageFirmwareVerify', () => ({
  useDeviceStageFirmwareVerify: () => ({
    runDeviceStageFirmwareVerify: (params: unknown) =>
      mockRunDeviceStageFirmwareVerify(params),
  }),
}));

jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {
    isFirmwareVerifySupported: () => true,
    buildDeviceStageName: () => 'OneKey Pro 2',
  },
}));

import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';

import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  EnumBasicDialogContentContainer,
  EFirmwareAuthenticationDialogContentType,
  FirmwareAuthenticationDialogContent,
  type IFirmwareVerifyDialogHost,
  useFirmwareVerifyDialog,
} from './FirmwareVerifyDialog';

describe('legacy firmware verification recovery', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockFirmwareAuthenticate.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([10_104, 10_106, 10_107])(
    'preserves retry handling for server code %s without checking firmware or continuing',
    async (code) => {
      mockFirmwareAuthenticate.mockResolvedValue({
        verified: false,
        result: { code },
      });
      const onContinue = jest.fn();
      render(
        <FirmwareAuthenticationDialogContent
          device={{ connectId: 'connect-id', deviceType: 'pro2' } as IDBDevice}
          useNewProcess
          onContinue={onContinue}
        />,
      );

      await act(async () => {
        await jest.advanceTimersByTimeAsync(50);
      });

      expect(
        screen.getByText(
          code === 10_104
            ? ETranslations.global_network_error
            : ETranslations.device_auth_temporarily_unavailable,
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          ETranslations.device_auth_unofficial_device_detected_help_text,
        ),
      ).toBeNull();
      expect(mockGetFirmwareVerificationFeatures).not.toHaveBeenCalled();
      expect(mockVerifyFirmwareHash).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: ETranslations.global_retry }),
        );
      });

      expect(mockFirmwareAuthenticate).toHaveBeenCalledTimes(2);
      expect(onContinue).not.toHaveBeenCalled();
      expect(
        screen.queryByText(ETranslations.global_continue_anyway),
      ).toBeNull();
    },
  );

  it.each([10_100, 10_105])(
    'keeps authenticity failure %s terminal',
    async (code) => {
      mockFirmwareAuthenticate.mockResolvedValue({
        verified: false,
        result: { code },
      });
      const onContinue = jest.fn();
      render(
        <FirmwareAuthenticationDialogContent
          device={{ connectId: 'connect-id', deviceType: 'pro2' } as IDBDevice}
          useNewProcess
          onContinue={onContinue}
        />,
      );
      await act(async () => {
        await jest.advanceTimersByTimeAsync(50);
      });

      expect(
        screen.getByText(
          ETranslations.device_auth_unofficial_device_detected_help_text,
        ),
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: ETranslations.global_retry }),
      ).toBeNull();
      expect(mockGetFirmwareVerificationFeatures).not.toHaveBeenCalled();
      expect(mockVerifyFirmwareHash).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: ETranslations.global_contact_us }),
      ).toBeTruthy();
      expect(
        screen.queryByText(ETranslations.global_continue_anyway),
      ).toBeNull();
      expect(onContinue).not.toHaveBeenCalled();
    },
  );

  it('continues after retry verifies both certificate and firmware', async () => {
    mockFirmwareAuthenticate
      .mockResolvedValueOnce({ verified: false, result: { code: 10_104 } })
      .mockResolvedValueOnce({
        verified: true,
        result: { code: 0, data: 'serial' },
      });
    mockGetFirmwareVerificationFeatures.mockResolvedValue({});
    mockVerifyFirmwareHash.mockResolvedValue({
      firmware: { isMatch: true },
      bluetooth: { isMatch: true },
      bootloader: { isMatch: true },
    });
    const onContinue = jest.fn();
    render(
      <FirmwareAuthenticationDialogContent
        device={{ connectId: 'connect-id', deviceType: 'pro2' } as IDBDevice}
        useNewProcess
        onContinue={onContinue}
      />,
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(50);
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: ETranslations.global_retry }),
      );
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1200);
    });

    expect(mockFirmwareAuthenticate).toHaveBeenCalledTimes(2);
    expect(mockVerifyFirmwareHash).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith({ checked: true });
  });
});

describe('DeviceStage certificate error classification', () => {
  // Exercise the real hook; the legacy-dialog tests above mock its entry point.
  const { useDeviceStageFirmwareVerify } = jest.requireActual<
    typeof import('./useDeviceStageFirmwareVerify')
  >('./useDeviceStageFirmwareVerify');

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirmwareAuthenticate.mockReset();
  });

  it.each([
    {
      name: 'invalid public-key certificate',
      response: { verified: false, result: { code: 10_105 } },
      reason: 'unofficialDevice',
    },
    {
      name: 'network service failure',
      response: { verified: false, result: { code: 10_104 } },
      reason: 'network',
    },
    {
      name: 'server unavailable',
      error: {
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
        code: 503,
        message: 'Service Unavailable',
      },
      reason: 'unavailable',
    },
    {
      name: 'request timeout',
      error: { code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' },
      reason: 'unknown',
    },
  ])('classifies $name without continuing verification', async (scenario) => {
    if ('error' in scenario) {
      mockFirmwareAuthenticate.mockRejectedValueOnce(scenario.error);
    } else {
      mockFirmwareAuthenticate.mockResolvedValueOnce(scenario.response);
    }
    const { result } = renderHook(() => useDeviceStageFirmwareVerify());
    let verification: Promise<unknown> | undefined;
    await act(async () => {
      verification = result.current.runDeviceStageFirmwareVerify({
        device: { connectId: 'connect-id', deviceType: 'pro2' } as IDBDevice,
        features: undefined,
      });
    });

    try {
      expect(mockDeviceStageNoteAuthStep).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'authFailure',
          failureReason: scenario.reason,
        }),
      );
      expect(mockDeviceStageNoteAuthStep).not.toHaveBeenCalledWith(
        expect.objectContaining({ step: 'authSuccess' }),
      );
      expect(mockGetFirmwareVerificationFeatures).not.toHaveBeenCalled();
      expect(mockVerifyFirmwareHash).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        appEventBus.emit(
          EAppEventBusNames.CloseHardwareUiStateDialogManually,
          undefined,
        );
        await expect(verification).resolves.toEqual({
          checked: false,
          closed: true,
        });
      });
    }
  });
});

describe('EnumBasicDialogContentContainer', () => {
  it('reserves unofficial copy for explicit authenticity failures', () => {
    const { rerender } = render(
      <EnumBasicDialogContentContainer
        contentType={
          EFirmwareAuthenticationDialogContentType.unofficial_device_detected
        }
        errorObj={{ code: 0 }}
      />,
    );

    expect(
      screen.getByText(
        ETranslations.device_auth_unofficial_device_detected_help_text,
      ),
    ).toBeTruthy();

    rerender(
      <EnumBasicDialogContentContainer
        contentType={EFirmwareAuthenticationDialogContentType.error_fallback}
        errorObj={{ code: 0 }}
      />,
    );

    expect(
      screen.getByText(ETranslations.global_unknown_error_retry_message),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        ETranslations.device_auth_unofficial_device_detected_help_text,
      ),
    ).toBeNull();
  });
});

describe('useFirmwareVerifyDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    legacyHardwareUiActive = false;
  });

  it('keeps the first close intent when the dialog closes more than once', async () => {
    // The legacy dialog is switched off by default now (the DeviceStage
    // plays the check); this asserts its own close idempotency, so it
    // names the path it exercises.
    legacyHardwareUiActive = true;
    let onDialogClose:
      | ((extra?: { flag?: string }) => Promise<void>)
      | undefined;
    const dialogHost = {
      show: jest.fn((props: { onClose: typeof onDialogClose }) => {
        onDialogClose = props.onClose;
        return { close: jest.fn() };
      }),
    } as unknown as IFirmwareVerifyDialogHost;
    const onClose = jest.fn();
    const { result } = renderHook(() => useFirmwareVerifyDialog());

    await act(async () => {
      await result.current.showFirmwareVerifyDialog({
        device: {
          connectId: 'connect-id',
          deviceType: 'pro2',
        } as IDBDevice,
        features: undefined,
        onContinue: jest.fn(),
        onClose,
        dialogHost,
      });
    });

    await act(async () => {
      await onDialogClose?.({ flag: 'firmwareVerifySkipDeviceCancel' });
      await onDialogClose?.();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockCloseHardwareUiStateDialog).toHaveBeenCalledTimes(1);
    expect(mockCloseHardwareUiStateDialog).toHaveBeenCalledWith({
      connectId: 'connect-id',
      deviceType: 'pro2',
      skipDeviceCancel: true,
    });
  });

  it('does not cancel the device again when the stage run ends without a verdict', async () => {
    // The stage answers a dismissal with its own cancel, and abort codes
    // must not cancel at all — so this close carries the skip flag.
    mockRunDeviceStageFirmwareVerify.mockResolvedValueOnce({
      checked: false,
      closed: true,
    });
    const onClose = jest.fn();
    const onContinue = jest.fn();
    const { result } = renderHook(() => useFirmwareVerifyDialog());

    await act(async () => {
      await result.current.showFirmwareVerifyDialog({
        device: {
          connectId: 'connect-id',
          deviceType: 'pro2',
        } as IDBDevice,
        features: undefined,
        onContinue,
        onClose,
      });
    });

    expect(onContinue).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockCloseHardwareUiStateDialog).toHaveBeenCalledWith({
      connectId: 'connect-id',
      deviceType: 'pro2',
      skipDeviceCancel: true,
    });
  });

  it('carries the stage verdict through to the caller', async () => {
    mockRunDeviceStageFirmwareVerify.mockResolvedValueOnce({ checked: true });
    const onContinue = jest.fn();
    const onVerified = jest.fn();
    const { result } = renderHook(() => useFirmwareVerifyDialog());

    await act(async () => {
      await result.current.showFirmwareVerifyDialog({
        device: {
          connectId: 'connect-id',
          deviceType: 'pro2',
        } as IDBDevice,
        features: undefined,
        onContinue,
        onVerified,
        onClose: jest.fn(),
      });
    });

    expect(onVerified).toHaveBeenCalledWith({ checked: true });
    expect(onContinue).toHaveBeenCalledWith({ checked: true });
  });
});
