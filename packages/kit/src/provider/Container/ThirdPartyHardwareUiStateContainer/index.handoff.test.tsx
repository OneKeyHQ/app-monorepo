/** @jest-environment jsdom */
import { useSyncExternalStore } from 'react';

import { ThirdPartyHardwareUiStateContainer } from '.';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';
import { act, render } from '@testing-library/react';

import { Dialog, resetScanModalRoute } from '@onekeyhq/components';
import { showThirdPartyDeviceSelectionDialog } from '@onekeyhq/kit/src/components/Hardware/ThirdPartyDeviceSelectionDialog';
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
let mockVisible = true;
const mockVisibilityListeners = new Set<(visible: boolean) => void>();
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => mockVisible,
  onVisibilityStateChange: (listener: (visible: boolean) => void) => {
    mockVisibilityListeners.add(listener);
    return () => {
      mockVisibilityListeners.delete(listener);
    };
  },
}));
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
// The stage presents the code, then scans the device's answer.
const mockTwoWayScan = jest.fn<
  Promise<{ type: string; cbor: string }>,
  [
    { type: string; cbor: string },
    { owner?: string; notice?: { key?: string } },
  ]
>(() => new Promise(() => undefined));
const mockCancelStageScan = jest.fn(
  async (_params: { owner?: string }) => undefined,
);
const mockStageScan = jest.fn<
  Promise<{ type: string; cbor: string } | undefined>,
  [{ owner?: string }]
>(() => new Promise(() => undefined));
const mockLegacyScan = jest.fn(async () => ({ raw: 'ur:bytes/mock' }));

jest.mock('../../../views/ScanQrCode/hooks/useScanQrCodeLazy', () => ({
  __esModule: true,
  default: () => ({ start: mockLegacyScan }),
}));
const mockHandleQrRequest = jest.fn(
  async (_params: { uiRequestId: string }) => undefined,
);
const mockResolveScan = jest.fn(async (_params: unknown) => undefined);
const mockRejectScan = jest.fn(async (_params: unknown) => undefined);
const mockClaimScan = jest.fn(async (_params: { promiseId: number }) => true);

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: jest.fn(() => ({ close: jest.fn().mockResolvedValue(undefined) })),
  },
  Portal: { Body: () => null, Constant: {} },
  ShowCustom: () => null,
  YStack: () => null,
  SizableText: () => null,
  resetScanModalRoute: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePromise: {
      resolveCallback: (params: unknown) => mockResolveScan(params),
      rejectCallback: (params: unknown) => mockRejectScan(params),
    },
    serviceQrWallet: {
      claimLegacyAirGapScan: (params: { promiseId: number }) =>
        mockClaimScan(params),
      scanAirGapOnStage: (options: { owner?: string }) =>
        mockStageScan(options),
      startTwoWayAirGapScan: (
        appUr: { type: string; cbor: string },
        options: { owner?: string; notice?: { key?: string } },
      ) => mockTwoWayScan(appUr, options),
      cancelStageAirGapScan: (params: { owner?: string }) =>
        mockCancelStageScan(params),
    },
    serviceThirdPartyHardware: {
      handleKeystoneQrRequest: (params: { uiRequestId: string }) =>
        mockHandleQrRequest(params),
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
jest.mock('../../../hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
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
  mockVisible = true;
  mockUiState = undefined;
  jest.mocked(yieldDeviceStageToDialog).mockResolvedValue(false);
  // Reset, not clear: an unconsumed once-value must not reach the next test.
  mockTwoWayScan.mockReset();
  mockTwoWayScan.mockImplementation(() => new Promise(() => undefined));
  mockStageScan.mockReset();
  mockStageScan.mockImplementation(() => new Promise(() => undefined));
  mockLegacyScan.mockReset();
  mockLegacyScan.mockResolvedValue({ raw: 'ur:bytes/mock' });
  mockClaimScan.mockReset();
  mockClaimScan.mockResolvedValue(true);
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

it.each([true, false])(
  'delegates a Keystone QR request to bg (display=%s)',
  async (display) => {
    mockUiState = qrState(display);
    const view = render(<ThirdPartyHardwareUiStateContainer />);
    await flush();
    expect(mockHandleQrRequest).toHaveBeenCalledWith({ uiRequestId: 'ui-qr' });
    expect(mockTwoWayScan).not.toHaveBeenCalled();
    expect(mockStageScan).not.toHaveBeenCalled();
    expect(mockLegacyScan).not.toHaveBeenCalled();
    view.unmount();
    await flush();
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockCancelStageScan).not.toHaveBeenCalled();
    expect(mockClearUiState).not.toHaveBeenCalled();
  },
);

it('keeps the surviving viewport attached when another viewport unmounts', async () => {
  mockUiState = qrState(true);
  const tab = render(<ThirdPartyHardwareUiStateContainer />);
  const popup = render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  expect(mockHandleQrRequest).toHaveBeenCalledTimes(2);
  popup.unmount();
  await flush();
  expect(mockCancel).not.toHaveBeenCalled();
  expect(mockCancelStageScan).not.toHaveBeenCalled();
  publishState({ ...qrState(true), uiRequestId: 'next-qr' });
  await flush();
  expect(mockHandleQrRequest).toHaveBeenLastCalledWith({
    uiRequestId: 'next-qr',
  });
  tab.unmount();
});

it('returns a legacy camera result to the background callback', async () => {
  render(<ThirdPartyHardwareUiStateContainer />);
  act(() => {
    appEventBus.emit(EAppEventBusNames.ScanAirGapQrcode, { promiseId: 42 });
  });
  await flush();
  expect(mockLegacyScan).toHaveBeenCalledTimes(1);
  expect(mockLegacyScan).toHaveBeenCalledWith(
    expect.objectContaining({ scanRequestId: 'air-gap:42' }),
  );
  expect(mockResolveScan).toHaveBeenCalledWith({
    id: 42,
    data: { raw: 'ur:bytes/mock' },
  });
  expect(mockUiResponse).not.toHaveBeenCalled();
  expect(mockCancel).not.toHaveBeenCalled();
});

it('closes only the cancelled fallback scan and ignores its delayed result', async () => {
  let resolveOldScan: (result: { raw: string }) => void = () => undefined;
  mockLegacyScan.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOldScan = resolve;
      }),
  );
  render(<ThirdPartyHardwareUiStateContainer />);
  act(() => {
    appEventBus.emit(EAppEventBusNames.ScanAirGapQrcode, { promiseId: 41 });
  });
  await flush();
  act(() => {
    appEventBus.emit(EAppEventBusNames.ScanAirGapQrcode, { promiseId: 42 });
    appEventBus.emit(EAppEventBusNames.CancelAirGapQrcodeScan, {
      promiseId: 41,
    });
  });
  await flush();
  expect(resetScanModalRoute).toHaveBeenCalledWith({
    scanRequestId: 'air-gap:41',
  });
  resolveOldScan({ raw: 'ur:bytes/old' });
  await flush();
  expect(mockResolveScan).toHaveBeenCalledTimes(1);
  expect(mockResolveScan).toHaveBeenCalledWith({
    id: 42,
    data: { raw: 'ur:bytes/mock' },
  });
  expect(mockRejectScan).not.toHaveBeenCalled();
  expect(mockCancel).not.toHaveBeenCalled();
});

it('does not open a fallback camera cancelled while waiting for the stage', async () => {
  const release = holdExit();
  render(<ThirdPartyHardwareUiStateContainer />);
  act(() => {
    appEventBus.emit(EAppEventBusNames.ScanAirGapQrcode, { promiseId: 42 });
    appEventBus.emit(EAppEventBusNames.CancelAirGapQrcodeScan, {
      promiseId: 42,
    });
  });
  await release();
  await flush();
  expect(mockLegacyScan).not.toHaveBeenCalled();
  expect(mockResolveScan).not.toHaveBeenCalled();
  expect(mockRejectScan).not.toHaveBeenCalled();
});

it('opens a fallback camera in only the viewport that claims it', async () => {
  mockClaimScan.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  mockLegacyScan.mockImplementationOnce(() => new Promise(() => undefined));
  const owner = render(<ThirdPartyHardwareUiStateContainer />);
  const other = render(<ThirdPartyHardwareUiStateContainer />);
  act(() => {
    appEventBus.emit(EAppEventBusNames.ScanAirGapQrcode, { promiseId: 42 });
  });
  await flush();
  expect(mockClaimScan).toHaveBeenCalledTimes(2);
  expect(mockLegacyScan).toHaveBeenCalledTimes(1);
  other.unmount();
  await flush();
  expect(mockRejectScan).not.toHaveBeenCalled();
  owner.unmount();
  await flush();
  expect(mockRejectScan).toHaveBeenCalledWith({
    id: 42,
    error: expect.any(Error),
  });
  expect(mockCancel).not.toHaveBeenCalled();
});

it('settles a claim that finishes after its viewport closes', async () => {
  let claim: (value: boolean) => void = () => undefined;
  mockClaimScan.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        claim = resolve;
      }),
  );
  const view = render(<ThirdPartyHardwareUiStateContainer />);
  act(() => {
    appEventBus.emit(EAppEventBusNames.ScanAirGapQrcode, { promiseId: 42 });
  });
  await flush();
  view.unmount();
  claim(true);
  await flush();
  expect(mockLegacyScan).not.toHaveBeenCalled();
  expect(mockRejectScan).toHaveBeenCalledWith({
    id: 42,
    error: expect.any(Error),
  });
});

it('keeps a hidden page from claiming the camera and wakes bg when it becomes visible', async () => {
  mockVisible = false;
  mockUiState = qrState(false);
  render(<ThirdPartyHardwareUiStateContainer />);
  act(() => {
    appEventBus.emit(EAppEventBusNames.ScanAirGapQrcode, { promiseId: 42 });
  });
  await flush();
  expect(mockHandleQrRequest).not.toHaveBeenCalled();
  expect(mockClaimScan).not.toHaveBeenCalled();
  mockVisible = true;
  act(() => {
    mockVisibilityListeners.forEach((listener) => listener(true));
  });
  await flush();
  expect(mockHandleQrRequest).toHaveBeenCalledWith({ uiRequestId: 'ui-qr' });
  act(() => {
    appEventBus.emit(EAppEventBusNames.ScanAirGapQrcode, { promiseId: 42 });
    appEventBus.emit(EAppEventBusNames.ScanAirGapQrcode, { promiseId: 42 });
  });
  await flush();
  expect(mockClaimScan).toHaveBeenCalledTimes(1);
  expect(mockLegacyScan).toHaveBeenCalledTimes(1);
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
