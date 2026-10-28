/** @jest-environment jsdom */
import { useSyncExternalStore } from 'react';

import { ThirdPartyHardwareUiStateContainer } from '.';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';
import { act, render } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import { showThirdPartyDeviceSelectionDialog } from '@onekeyhq/kit/src/components/Hardware/ThirdPartyDeviceSelectionDialog';
import { EThirdPartyHardwareUiAction } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IThirdPartyHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EThirdPartyDevicePermissionDeniedReason } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
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
jest.mock('@onekeyhq/qr-wallet-sdk', () => ({
  airGapUrUtils: {
    qrcodeToUr: jest.fn(async () => ({
      type: 'crypto-multi-accounts',
      cbor: Buffer.from('a0', 'hex'),
    })),
  },
}));

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
    serviceQrWallet: {
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
  mockUiState = undefined;
  jest.mocked(yieldDeviceStageToDialog).mockResolvedValue(false);
  // Reset, not clear: an unconsumed once-value must not reach the next test.
  mockTwoWayScan.mockReset();
  mockTwoWayScan.mockImplementation(() => new Promise(() => undefined));
  mockStageScan.mockReset();
  mockStageScan.mockImplementation(() => new Promise(() => undefined));
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

it('answers a scan-only Keystone request with the stage camera result', async () => {
  mockUiState = qrState(false);
  mockStageScan.mockResolvedValueOnce({
    type: 'crypto-multi-accounts',
    cbor: 'a0',
  });
  render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  expect(mockCancel).not.toHaveBeenCalled();
  expect(mockStageScan).toHaveBeenCalledWith({ owner: expect.any(String) });
  expect(mockUiResponse).toHaveBeenCalledWith({
    vendor: EHardwareVendor.keystone,
    response: {
      type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
      payload: { urType: 'crypto-multi-accounts', urData: 'a0' },
    },
  });
  expect(mockTwoWayScan).not.toHaveBeenCalled();
  expect(mockLegacyScan).not.toHaveBeenCalled();
});

it('uses the scan page when the stage is unavailable for a scan-only request', async () => {
  mockUiState = qrState(false);
  mockStageScan.mockResolvedValueOnce(undefined);
  render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  expect(yieldDeviceStageToDialog).toHaveBeenCalledTimes(1);
  expect(mockLegacyScan).toHaveBeenCalledTimes(1);
  expect(mockUiResponse).toHaveBeenCalledWith(
    expect.objectContaining({
      response: {
        type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
        payload: { urType: 'crypto-multi-accounts', urData: 'a0' },
      },
    }),
  );
  expect(mockCancel).not.toHaveBeenCalled();
});

it('ends a scan-only SDK request when the stage camera is closed', async () => {
  mockUiState = qrState(false);
  mockStageScan.mockRejectedValueOnce({
    className: EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel,
  });
  render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  expect(mockCancel).toHaveBeenCalledTimes(1);
  expect(mockUiResponse).not.toHaveBeenCalled();
});

const exportQrState = (): IThirdPartyHardwareUiState => ({
  ...qrState(true),
  payload: {
    urType: 'qr-hardware-call',
    urData: 'a0',
    allowAccountExport: true,
  },
});

it('shows the Keystone QR on the stage, which it does not leave', async () => {
  mockUiState = qrState(true);
  render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  expect(mockTwoWayScan).toHaveBeenCalledWith(
    { type: 'eth-sign-request', cbor: 'a0' },
    { owner: expect.any(String) },
  );
  expect(yieldDeviceStageToDialog).not.toHaveBeenCalled();
});

it('answers with an account export, and its note, where the request accepts one', async () => {
  mockUiState = exportQrState();
  mockTwoWayScan.mockResolvedValueOnce({
    type: 'crypto-multi-accounts',
    cbor: 'a0',
  });
  render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  expect(mockTwoWayScan.mock.calls[0][1].notice).toEqual({
    key: ETranslations.keystone_account_export__desc,
  });
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
  mockTwoWayScan.mockResolvedValueOnce({ type: 'eth-signature', cbor: 'a1' });
  render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  expect(mockTwoWayScan.mock.calls[0][1].notice).toBeUndefined();
  expect(mockUiResponse).toHaveBeenCalledWith({
    vendor: EHardwareVendor.keystone,
    response: {
      type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
      payload: { urType: 'eth-signature', urData: 'a1' },
    },
  });
});

it('reports undecodable export data to the SDK instead of treating it as cancellation', async () => {
  mockUiState = exportQrState();
  // The stage scan throws its invalid-code error, which has no class of its own.
  mockTwoWayScan.mockRejectedValueOnce({
    className: EOneKeyErrorClassNames.OneKeyAppError,
    message: 'OneKeyErrorAirGapInvalidQrCode',
  });
  render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  expect(mockUiResponse).toHaveBeenCalledWith({
    vendor: EHardwareVendor.keystone,
    response: {
      type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
      payload: { urType: '', urData: '', accountExport: true },
    },
  });
  expect(mockCancel).not.toHaveBeenCalled();
});

it.each([
  EOneKeyErrorClassNames.SecureQRCodeDialogCancel,
  EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel,
])(
  'ends the request when the stage closes over the code (%s)',
  async (className) => {
    mockUiState = qrState(true);
    mockTwoWayScan.mockRejectedValueOnce({ className });
    render(<ThirdPartyHardwareUiStateContainer />);
    await flush();
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockUiResponse).not.toHaveBeenCalled();
  },
);

it('does not cancel the SDK request when another UI takes over its stage session', async () => {
  mockUiState = qrState(true);
  mockTwoWayScan.mockRejectedValueOnce({
    className: EOneKeyErrorClassNames.SecureQRCodeDialogCancel,
    data: { stageAirGapSuperseded: true },
  });
  const view = render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  view.unmount();
  await flush();
  expect(mockCancel).not.toHaveBeenCalled();
  expect(mockUiResponse).not.toHaveBeenCalled();
  expect(mockClearUiState).not.toHaveBeenCalled();
  expect(mockCancelStageScan).not.toHaveBeenCalled();
});

it('ends its own stage session when the SDK ends the QR request', async () => {
  mockUiState = qrState(true);
  const view = render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  const { owner } = mockTwoWayScan.mock.calls[0][1];
  expect(owner).toEqual(expect.any(String));

  // A timeout or abort clears the request under the open stage session.
  publishState(undefined);
  view.rerender(<ThirdPartyHardwareUiStateContainer />);
  await flush();

  expect(mockCancelStageScan).toHaveBeenCalledTimes(1);
  expect(mockCancelStageScan).toHaveBeenCalledWith({ owner });
});

it('leaves the stage alone once its code has been answered', async () => {
  mockUiState = qrState(true);
  mockTwoWayScan.mockResolvedValueOnce({ type: 'eth-signature', cbor: 'a1' });
  const view = render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  expect(mockUiResponse).toHaveBeenCalledTimes(1);

  publishState(undefined);
  view.rerender(<ThirdPartyHardwareUiStateContainer />);
  await flush();

  expect(mockCancelStageScan).not.toHaveBeenCalled();
});

it('tags each request with its own stage owner', async () => {
  mockUiState = qrState(true);
  const view = render(<ThirdPartyHardwareUiStateContainer />);
  await flush();
  publishState({ ...qrState(true), uiRequestId: 'ui-qr-2' });
  view.rerender(<ThirdPartyHardwareUiStateContainer />);
  await flush();

  const [first, second] = mockTwoWayScan.mock.calls.map(
    ([, options]) => options.owner,
  );
  expect(second).toEqual(expect.any(String));
  expect(second).not.toBe(first);
  // The replaced request's cleanup names only its own session.
  expect(mockCancelStageScan).toHaveBeenCalledWith({ owner: first });
  expect(mockCancelStageScan).not.toHaveBeenCalledWith({ owner: second });
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
