/** @jest-environment jsdom */
/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
}));

jest.mock('@onekeyhq/components', () => ({
  Anchor: 'Anchor',
  Button: 'Button',
  Dialog: { show: jest.fn() },
  HeightTransition: 'HeightTransition',
  Icon: 'Icon',
  SizableText: 'SizableText',
  Spinner: 'Spinner',
  Stack: 'Stack',
  XStack: 'XStack',
  YStack: 'YStack',
  useDialogInstance: jest.fn(),
}));

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

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      shouldAuthenticateFirmwareByHash: (params: unknown) =>
        mockShouldAuthenticateFirmwareByHash(params),
    },
    serviceHardwareUI: {
      closeHardwareUiStateDialog: (params: unknown) =>
        mockCloseHardwareUiStateDialog(params),
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
  },
}));

import { act, renderHook } from '@testing-library/react';

import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';

import {
  type IFirmwareVerifyDialogHost,
  useFirmwareVerifyDialog,
} from './FirmwareVerifyDialog';

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
