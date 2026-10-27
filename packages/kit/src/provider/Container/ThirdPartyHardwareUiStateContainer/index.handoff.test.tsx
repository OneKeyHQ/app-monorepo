/** @jest-environment jsdom */
import { useSyncExternalStore } from 'react';

import { ThirdPartyHardwareUiStateContainer } from '.';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';
import { act, render } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import { showThirdPartyDeviceSelectionDialog } from '@onekeyhq/kit/src/components/Hardware/ThirdPartyDeviceSelectionDialog';
import { SecureQRToast } from '@onekeyhq/kit/src/components/SecureQRToast';
import { EThirdPartyHardwareUiAction } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IThirdPartyHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EThirdPartyDevicePermissionDeniedReason } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { yieldDeviceStageToDialog } from '../DeviceStageContainer/waitForDeviceStageExit';

let mockUiState: IThirdPartyHardwareUiState | undefined;
const mockUiListeners = new Set<() => void>();
const mockSubscribe = (listener: () => void) => {
  mockUiListeners.add(listener);
  return () => {
    mockUiListeners.delete(listener);
  };
};
const mockCancel = jest.fn(async () => undefined);
const mockUiResponse = jest.fn(async (_params: unknown) => undefined);
const mockClearUiState = jest.fn(async (_params: unknown) => true);
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockStartScan = jest.fn<Promise<{ raw: string }>, [unknown]>(
  () => new Promise(() => undefined),
);
const mockDecodeUr = jest.fn(async (_raw: string) => ({
  type: 'crypto-multi-accounts',
  cbor: Buffer.from('a0', 'hex'),
}));
const mockScanHook = { start: mockStartScan };

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: jest.fn(() => ({ close: jest.fn().mockResolvedValue(undefined) })),
  },
  Portal: { Body: () => null, Constant: {} },
  ShowCustom: () => null,
  YStack: () => null,
  SizableText: () => null,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceThirdPartyHardware: {
      thirdPartyHardwareUiResponse: (params: unknown) => mockUiResponse(params),
      thirdPartyHardwareCancel: () => mockCancel(),
      clearThirdPartyHardwareUiStateIfCurrent: (params: unknown) =>
        mockClearUiState(params),
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms');
  return {
    ...actual,
    useThirdPartyHardwareUiStateAtom: () => [
      useSyncExternalStore(mockSubscribe, () => mockUiState),
    ],
    useThirdPartyBleBindingAtom: () => [undefined],
    useThirdPartyAppInstallAtom: () => [undefined],
    useThirdPartyBatchInstallAtom: () => [undefined],
    thirdPartyHardwareUiStateAtom: { get: async () => mockUiState },
  };
});
jest.mock('@onekeyhq/qr-wallet-sdk', () => ({
  airGapUrUtils: { qrcodeToUr: (raw: string) => mockDecodeUr(raw) },
}));
jest.mock('../../../components/Hardware/Hardware', () => ({
  EnterPhase: () => null,
}));
jest.mock('../../../components/Hardware/HardwareDialog', () => ({
  OpenBleSettingsDialog: () => null,
  RequireBlePermissionDialog: () => null,
}));
jest.mock(
  '../../../components/Hardware/ThirdPartyDeviceSelectionDialog',
  () => ({
    // Like the real dialog, closing it runs its onClose.
    showThirdPartyDeviceSelectionDialog: jest.fn(
      (params: { onClose?: () => Promise<void> }) => ({
        close: jest.fn(async () => {
          await params.onClose?.();
        }),
      }),
    ),
  }),
);
jest.mock('../../../components/SecureQRToast', () => ({
  SecureQRToast: {
    show: jest.fn(() => ({ close: jest.fn().mockResolvedValue(undefined) })),
  },
}));
jest.mock('../../../hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock('../../../views/ScanQrCode/hooks/useScanQrCodeLazy', () => ({
  __esModule: true,
  default: () => mockScanHook,
}));
jest.mock('../DeviceStageContainer/waitForDeviceStageExit', () => ({
  yieldDeviceStageToDialog: jest.fn(),
}));
jest.mock('./TrezorPinMatrix', () => ({ TrezorPinMatrix: () => null }));

function selectionState(vendor: EHardwareVendor): IThirdPartyHardwareUiState {
  return {
    uiRequestId: 'ui-selection',
    vendor,
    action: EThirdPartyHardwareUiAction.requestDeviceSelection,
    payload: {
      deviceSearchTargets: [
        {
          vendor,
          searchTargetId: 'target-1',
          kind: 'physical',
          connectionType: 'usb',
        },
      ],
      deviceSelection: {
        requestId: 'sdk-selection',
        context: {
          kind: 'select-device',
          transport: 'usb',
          reason: 'multiple-candidates',
        },
      },
    },
  };
}

function qrState(display: boolean): IThirdPartyHardwareUiState {
  return {
    uiRequestId: 'ui-qr',
    vendor: EHardwareVendor.keystone,
    action: display
      ? EThirdPartyHardwareUiAction.requestKeystoneQrDisplay
      : EThirdPartyHardwareUiAction.requestKeystoneQrScan,
    payload: display ? { urType: 'eth-sign-request', urData: 'a0' } : undefined,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function holdExit() {
  let release: () => void = () => undefined;
  const promise = new Promise<boolean>((resolve) => {
    release = () => resolve(false);
  });
  jest.mocked(yieldDeviceStageToDialog).mockReturnValue(promise);
  return async () => {
    await act(async () => {
      release();
      await promise;
    });
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUiState = undefined;
  jest.mocked(yieldDeviceStageToDialog).mockResolvedValue(false);
});

it.each([
  EHardwareVendor.trezor,
  EHardwareVendor.ledger,
  EHardwareVendor.keystone,
])('waits for the stage before showing %s selection', async (vendor) => {
  mockUiState = selectionState(vendor);
  const release = holdExit();
  render(<ThirdPartyHardwareUiStateContainer />);
  expect(showThirdPartyDeviceSelectionDialog).not.toHaveBeenCalled();
  await release();
  expect(showThirdPartyDeviceSelectionDialog).toHaveBeenCalledTimes(1);
});

it('does not open a selection that ended while the stage was leaving', async () => {
  mockUiState = selectionState(EHardwareVendor.ledger);
  const release = holdExit();
  const view = render(<ThirdPartyHardwareUiStateContainer />);
  act(() => {
    mockUiState = undefined;
    mockUiListeners.forEach((listener) => listener());
  });
  view.rerender(<ThirdPartyHardwareUiStateContainer />);
  await release();
  expect(showThirdPartyDeviceSelectionDialog).not.toHaveBeenCalled();
});

function publishState(state: IThirdPartyHardwareUiState | undefined) {
  act(() => {
    mockUiState = state;
    mockUiListeners.forEach((listener) => listener());
  });
}

it('cancels an unanswered selection that another request replaced', async () => {
  mockUiState = selectionState(EHardwareVendor.ledger);
  const view = render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  expect(showThirdPartyDeviceSelectionDialog).toHaveBeenCalledTimes(1);

  publishState(qrState(false));
  view.rerender(<ThirdPartyHardwareUiStateContainer />);
  await flush();

  expect(mockUiResponse).toHaveBeenCalledWith({
    vendor: EHardwareVendor.ledger,
    response: {
      type: UI_RESPONSE.RECEIVE_SELECT_DEVICE,
      payload: { requestId: 'sdk-selection', cancelled: true },
    },
  });
});

it('keeps an unanswered selection open when the same request is republished (e.g. a language change)', async () => {
  mockUiState = selectionState(EHardwareVendor.ledger);
  const view = render(<ThirdPartyHardwareUiStateContainer />);
  await flush();

  publishState(selectionState(EHardwareVendor.ledger));
  view.rerender(<ThirdPartyHardwareUiStateContainer />);
  await flush();

  expect(mockUiResponse).not.toHaveBeenCalled();
  expect(mockCancel).not.toHaveBeenCalled();
  expect(mockClearUiState).not.toHaveBeenCalled();
  expect(showThirdPartyDeviceSelectionDialog).toHaveBeenCalledTimes(2);
});

it('opens the next selection after the user cancels one', async () => {
  mockUiState = selectionState(EHardwareVendor.ledger);
  const view = render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  expect(showThirdPartyDeviceSelectionDialog).toHaveBeenCalledTimes(1);

  const [{ onClose }] = jest.mocked(showThirdPartyDeviceSelectionDialog).mock
    .calls[0];
  await act(async () => {
    await onClose?.();
  });
  publishState(undefined);
  view.rerender(<ThirdPartyHardwareUiStateContainer />);
  await flush();

  const next = selectionState(EHardwareVendor.ledger);
  publishState({
    ...next,
    uiRequestId: 'ui-selection-2',
    payload: {
      ...next.payload,
      deviceSelection: {
        ...next.payload?.deviceSelection,
        requestId: 'sdk-selection-2',
      },
    },
  } as IThirdPartyHardwareUiState);
  view.rerender(<ThirdPartyHardwareUiStateContainer />);
  await flush();

  expect(showThirdPartyDeviceSelectionDialog).toHaveBeenCalledTimes(2);
});

it('waits before opening the Keystone scanner', async () => {
  mockUiState = qrState(false);
  const release = holdExit();
  render(<ThirdPartyHardwareUiStateContainer />);
  expect(yieldDeviceStageToDialog).toHaveBeenCalledTimes(1);
  expect(mockStartScan).not.toHaveBeenCalled();
  await release();
  expect(mockStartScan).toHaveBeenCalledTimes(1);
});

it('waits before showing the Keystone QR so the stage cannot cover it', async () => {
  mockUiState = qrState(true);
  const releaseDisplay = holdExit();
  render(<ThirdPartyHardwareUiStateContainer />);
  expect(yieldDeviceStageToDialog).toHaveBeenCalledTimes(1);
  expect(SecureQRToast.show).not.toHaveBeenCalled();
  await releaseDisplay();
  expect(SecureQRToast.show).toHaveBeenCalledTimes(1);

  const releaseScan = holdExit();
  await act(async () => {
    jest.mocked(SecureQRToast.show).mock.calls[0][0].onConfirm?.();
  });
  expect(yieldDeviceStageToDialog).toHaveBeenCalledTimes(2);
  expect(mockStartScan).not.toHaveBeenCalled();
  await releaseScan();
  expect(mockStartScan).toHaveBeenCalledTimes(1);
});

it('opens the explicit export scanner before any device response or error', async () => {
  mockUiState = {
    ...qrState(true),
    payload: {
      urType: 'qr-hardware-call',
      urData: 'a0',
      allowAccountExport: true,
    },
  };
  mockStartScan.mockResolvedValueOnce({ raw: 'fixture-account-export' });
  render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  const props = jest.mocked(SecureQRToast.show).mock.calls[0][0];
  expect(props.title).toBe(ETranslations.device_stage_connect_vendor__title);
  expect(props.message).toBe(ETranslations.device_stage_show_qr__title);
  expect(props.extraAction?.title).toBe(
    ETranslations.keystone_specialized_firmware__title,
  );
  expect(props.extraAction?.description).toBe(
    ETranslations.keystone_account_export__desc,
  );
  expect(props.extraAction?.label).toBe(
    ETranslations.keystone_scan_account_export__action,
  );
  expect(props.extraAction?.testID).toBe('keystone-scan-account-export-btn');
  expect(mockStartScan).not.toHaveBeenCalled();
  expect(mockUiResponse).not.toHaveBeenCalled();
  await act(async () => {
    await props.extraAction?.onPress();
  });
  expect(mockStartScan).toHaveBeenCalledTimes(1);
  expect(mockUiResponse).toHaveBeenCalledWith({
    vendor: EHardwareVendor.keystone,
    response: {
      type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
      payload: {
        urType: 'crypto-multi-accounts',
        urData: 'a0',
        accountExport: true,
      },
    },
  });
  expect(mockCancel).not.toHaveBeenCalled();
});

it('keeps signing QR scans on the normal response path', async () => {
  mockUiState = qrState(true);
  mockStartScan.mockResolvedValueOnce({ raw: 'fixture-signature' });
  mockDecodeUr.mockResolvedValueOnce({
    type: 'eth-signature',
    cbor: Buffer.from('a1', 'hex'),
  });
  render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  const props = jest.mocked(SecureQRToast.show).mock.calls[0][0];
  expect(props.title).toBeUndefined();
  expect(props.extraAction).toBeUndefined();
  await act(async () => {
    props.onConfirm?.();
  });
  expect(mockUiResponse).toHaveBeenCalledWith({
    vendor: EHardwareVendor.keystone,
    response: {
      type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
      payload: { urType: 'eth-signature', urData: 'a1' },
    },
  });
});

it('reports undecodable export data to the SDK instead of treating it as cancellation', async () => {
  mockUiState = {
    ...qrState(true),
    payload: {
      urType: 'qr-hardware-call',
      urData: 'a0',
      allowAccountExport: true,
    },
  };
  mockStartScan.mockResolvedValueOnce({ raw: 'not-an-account-code' });
  mockDecodeUr.mockRejectedValueOnce(new Error('Cannot decode code'));
  render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  await act(async () => {
    await jest
      .mocked(SecureQRToast.show)
      .mock.calls[0][0].extraAction?.onPress();
  });
  expect(mockUiResponse).toHaveBeenCalledWith({
    vendor: EHardwareVendor.keystone,
    response: {
      type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
      payload: { urType: '', urData: '', accountExport: true },
    },
  });
  expect(mockCancel).not.toHaveBeenCalled();
});

it('does not open the scanner after its QR request was cancelled during the exit', async () => {
  mockUiState = qrState(false);
  const release = holdExit();
  const view = render(<ThirdPartyHardwareUiStateContainer />);
  view.unmount();
  await release();
  expect(mockStartScan).not.toHaveBeenCalled();
  expect(mockCancel).toHaveBeenCalledTimes(1);
});

it('hands the stage to the Bluetooth settings dialog', async () => {
  const release = holdExit();
  render(<ThirdPartyHardwareUiStateContainer />);
  act(() => {
    appEventBus.emit(EAppEventBusNames.ShowThirdPartyHardwarePermissionDialog, {
      vendor: EHardwareVendor.ledger,
      reason: EThirdPartyDevicePermissionDeniedReason.bluetoothTurnedOff,
    });
  });
  await flush();
  expect(yieldDeviceStageToDialog).toHaveBeenCalledTimes(1);
  expect(Dialog.show).not.toHaveBeenCalled();
  await release();
  expect(Dialog.show).toHaveBeenCalledTimes(1);
});
