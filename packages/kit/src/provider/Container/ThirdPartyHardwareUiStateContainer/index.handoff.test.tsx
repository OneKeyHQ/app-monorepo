/** @jest-environment jsdom */
import { useSyncExternalStore } from 'react';

import { ThirdPartyHardwareUiStateContainer } from '.';

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
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockStartScan = jest.fn(() => new Promise<never>(() => undefined));
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
      thirdPartyHardwareUiResponse: jest.fn().mockResolvedValue(undefined),
      thirdPartyHardwareCancel: () => mockCancel(),
      clearThirdPartyHardwareUiStateIfCurrent: jest
        .fn()
        .mockResolvedValue(true),
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
jest.mock('@onekeyhq/qr-wallet-sdk', () => ({ airGapUrUtils: {} }));
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
    showThirdPartyDeviceSelectionDialog: jest.fn(() => ({
      close: jest.fn().mockResolvedValue(undefined),
    })),
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
  const promise = new Promise<void>((resolve) => {
    release = resolve;
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
  jest.mocked(yieldDeviceStageToDialog).mockResolvedValue(undefined);
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
