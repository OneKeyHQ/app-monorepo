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
  const Div = ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => React.createElement('div', { onClick: onPress }, children);
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

let mockDeveloperMode = false;
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: mockDeveloperMode }],
}));

let mockIsDev = false;
jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/platformEnv')
  >('@onekeyhq/shared/src/platformEnv');
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      get isDev() {
        return mockIsDev;
      },
    },
  };
});

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
const mockDeviceStageNoteAuthResolved = jest.fn(async () => undefined);

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
      deviceStageNoteAuthResolved: () => mockDeviceStageNoteAuthResolved(),
      deviceStageNoteError: jest.fn(async () => undefined),
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

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
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

beforeEach(() => {
  mockIsDev = false;
  mockDeveloperMode = false;
});

describe('legacy firmware verification recovery', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIsDev = false;
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
    'keeps authenticity failure %s blocked until the hidden override is used',
    async (code) => {
      mockFirmwareAuthenticate.mockResolvedValue({
        verified: false,
        result: { code },
      });
      const onContinue = jest.fn();
      const onDevSkipVerificationPress = jest.fn();
      render(
        <FirmwareAuthenticationDialogContent
          device={{ connectId: 'connect-id', deviceType: 'pro2' } as IDBDevice}
          useNewProcess
          onContinue={onContinue}
          onDevSkipVerificationPress={onDevSkipVerificationPress}
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
      const title = screen.getByText(
        ETranslations.device_auth_unofficial_device_detected,
      );
      for (let i = 0; i < 9; i += 1) fireEvent.click(title);
      expect(
        screen.queryByText('Skip it And Create Wallet(Only in Dev)'),
      ).toBeNull();
      fireEvent.click(title);
      fireEvent.click(
        screen.getByText('Skip it And Create Wallet(Only in Dev)'),
      );
      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(onContinue).toHaveBeenCalledWith({ checked: false });
      expect(onDevSkipVerificationPress).toHaveBeenCalledTimes(1);
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

  describe.each([
    { name: 'development build', isDev: true, developerMode: false },
    { name: 'App developer mode', isDev: false, developerMode: true },
  ])('$name', ({ isDev, developerMode }) => {
    it.each([
      {
        code: HardwareErrorCode.RuntimeError,
        message: 'Failure_ProcessError,SE request failed',
      },
      {
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
        code: 503,
        message: 'Service Unavailable',
      },
      { code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' },
      { code: HardwareErrorCode.NetworkError, message: 'Network error' },
      {
        code: HardwareErrorCode.DefectiveFirmware,
        message: 'Defective firmware',
      },
    ])(
      'only continues unverified after manual skip for $message',
      async (error) => {
        mockIsDev = isDev;
        mockDeveloperMode = developerMode;
        mockFirmwareAuthenticate.mockRejectedValueOnce(error);
        const { result } = renderHook(() => useDeviceStageFirmwareVerify());
        let verification: Promise<unknown> | undefined;
        await act(async () => {
          verification = result.current.runDeviceStageFirmwareVerify({
            device: {
              connectId: 'connect-id',
              deviceType: 'pro2',
            } as IDBDevice,
            features: undefined,
          });
        });
        expect(mockDeviceStageNoteAuthResolved).not.toHaveBeenCalled();
        expect(mockGetFirmwareVerificationFeatures).not.toHaveBeenCalled();
        expect(mockVerifyFirmwareHash).not.toHaveBeenCalled();
        await act(async () => {
          appEventBus.emit(EAppEventBusNames.DeviceStageAuthAction, {
            action: 'continueAnyway',
          });
          await expect(verification).resolves.toEqual({ checked: false });
        });
        expect(mockDeviceStageNoteAuthResolved).toHaveBeenCalledTimes(1);
        expect(mockDeviceStageNoteAuthStep).not.toHaveBeenCalledWith(
          expect.objectContaining({ step: 'authSuccess' }),
        );
      },
    );
  });

  it('uses current developer mode while a failed verification is waiting', async () => {
    mockDeveloperMode = true;
    mockFirmwareAuthenticate.mockRejectedValueOnce({
      code: HardwareErrorCode.RuntimeError,
      message: 'Failure_ProcessError,SE request failed',
    });
    const { result, rerender } = renderHook(() =>
      useDeviceStageFirmwareVerify(),
    );
    let verification: Promise<unknown> | undefined;
    await act(async () => {
      verification = result.current.runDeviceStageFirmwareVerify({
        device: { connectId: 'connect-id', deviceType: 'pro2' } as IDBDevice,
        features: undefined,
      });
    });
    mockDeveloperMode = false;
    rerender();
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.DeviceStageAuthAction, {
        action: 'continueAnyway',
      });
    });
    expect(mockDeviceStageNoteAuthResolved).not.toHaveBeenCalled();
    mockDeveloperMode = true;
    rerender();
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.DeviceStageAuthAction, {
        action: 'continueAnyway',
      });
      await expect(verification).resolves.toEqual({ checked: false });
    });
    expect(mockDeviceStageNoteAuthResolved).toHaveBeenCalledTimes(1);
  });

  it.each([HardwareErrorCode.PinInvalid, HardwareErrorCode.ActionCancelled])(
    'still aborts for error %s even with developer privileges',
    async (code) => {
      mockIsDev = true;
      mockDeveloperMode = true;
      mockFirmwareAuthenticate.mockRejectedValueOnce({ code });
      const { result } = renderHook(() => useDeviceStageFirmwareVerify());
      await act(async () => {
        await expect(
          result.current.runDeviceStageFirmwareVerify({
            device: {
              connectId: 'connect-id',
              deviceType: 'pro2',
            } as IDBDevice,
            features: undefined,
          }),
        ).resolves.toEqual({ checked: false, closed: true });
      });
      expect(mockDeviceStageNoteAuthResolved).not.toHaveBeenCalled();
    },
  );

  it.each(['unofficialDevice', 'unofficialFirmware'])(
    'continues unverified after the developer override for %s',
    async (reason) => {
      mockFirmwareAuthenticate.mockResolvedValueOnce(
        reason === 'unofficialDevice'
          ? { verified: false, result: { code: 10_105 } }
          : { verified: true, result: { code: 0, data: 'serial' } },
      );
      mockGetFirmwareVerificationFeatures.mockResolvedValue({});
      mockVerifyFirmwareHash.mockResolvedValue({
        firmware: { isMatch: false },
      });
      const { result } = renderHook(() => useDeviceStageFirmwareVerify());
      let verification: Promise<unknown> | undefined;
      await act(async () => {
        verification = result.current.runDeviceStageFirmwareVerify({
          device: { connectId: 'connect-id', deviceType: 'pro2' } as IDBDevice,
          features: undefined,
        });
      });
      expect(mockDeviceStageNoteAuthStep).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'authFailure', failureReason: reason }),
      );
      await act(async () => {
        appEventBus.emit(EAppEventBusNames.DeviceStageAuthAction, {
          action: 'continueAnyway',
        });
        await expect(verification).resolves.toEqual({ checked: false });
      });
      expect(mockDeviceStageNoteAuthResolved).toHaveBeenCalledTimes(1);
      expect(mockDeviceStageNoteAuthStep).not.toHaveBeenCalledWith(
        expect.objectContaining({ step: 'authSuccess' }),
      );
    },
  );

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
    {
      name: 'SE request failure',
      error: {
        code: HardwareErrorCode.RuntimeError,
        message: 'Failure_ProcessError,SE request failed',
      },
      reason: 'unknown',
    },
    {
      name: 'defective firmware',
      error: { code: HardwareErrorCode.DefectiveFirmware },
      reason: 'defective',
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
      if (scenario.reason !== 'unofficialDevice') {
        await act(async () => {
          appEventBus.emit(EAppEventBusNames.DeviceStageAuthAction, {
            action: 'continueAnyway',
          });
        });
        expect(mockDeviceStageNoteAuthResolved).not.toHaveBeenCalled();
      }
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
  it.each([
    EFirmwareAuthenticationDialogContentType.unofficial_device_detected,
    EFirmwareAuthenticationDialogContentType.unofficial_firmware_detected,
    EFirmwareAuthenticationDialogContentType.network_error,
    EFirmwareAuthenticationDialogContentType.verification_temporarily_unavailable,
    EFirmwareAuthenticationDialogContentType.error_fallback,
    EFirmwareAuthenticationDialogContentType.defective_firmware_detected,
  ])(
    'allows both developer modes to skip %s while keeping normal production blocked',
    (contentType) => {
      const onDevSkipVerificationPress = jest.fn();
      const renderContent = () => (
        <EnumBasicDialogContentContainer
          contentType={contentType}
          errorObj={{ code: 0 }}
          onDevSkipVerificationPress={onDevSkipVerificationPress}
        />
      );
      const { rerender } = render(renderContent());
      expect(
        screen.queryByText('Skip it And Create Wallet(Only in Dev)'),
      ).toBeNull();
      mockDeveloperMode = true;
      rerender(renderContent());
      fireEvent.click(
        screen.getByText('Skip it And Create Wallet(Only in Dev)'),
      );
      expect(onDevSkipVerificationPress).toHaveBeenCalledTimes(1);
      mockDeveloperMode = false;
      rerender(renderContent());
      expect(
        screen.queryByText('Skip it And Create Wallet(Only in Dev)'),
      ).toBeNull();
      mockIsDev = true;
      rerender(renderContent());
      fireEvent.click(
        screen.getByText('Skip it And Create Wallet(Only in Dev)'),
      );
      expect(onDevSkipVerificationPress).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    EFirmwareAuthenticationDialogContentType.default,
    EFirmwareAuthenticationDialogContentType.verifying,
    EFirmwareAuthenticationDialogContentType.verification_verify,
    EFirmwareAuthenticationDialogContentType.verification_successful,
  ])('does not offer skip before a failed verdict (%s)', (contentType) => {
    mockDeveloperMode = true;
    mockIsDev = true;
    render(
      <EnumBasicDialogContentContainer
        contentType={contentType}
        errorObj={{ code: 0 }}
        onDevSkipVerificationPress={jest.fn()}
      />,
    );
    expect(
      screen.queryByText('Skip it And Create Wallet(Only in Dev)'),
    ).toBeNull();
  });

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

  it.each([true, false])(
    'carries the stage verdict %s through to the caller',
    async (checked) => {
      mockRunDeviceStageFirmwareVerify.mockResolvedValueOnce({ checked });
      const onContinue = jest.fn();
      const onVerified = jest.fn();
      const onDevSkipVerificationPress = jest.fn();
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
          onDevSkipVerificationPress,
          onClose: jest.fn(),
        });
      });

      expect(onVerified).toHaveBeenCalledWith({ checked });
      expect(onContinue).toHaveBeenCalledWith({ checked });
      expect(onDevSkipVerificationPress).toHaveBeenCalledTimes(checked ? 0 : 1);
    },
  );
});
