/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { resetScanModalRoute } from '@onekeyhq/components';
import { OneKeyErrorScanQrCodeCancel } from '@onekeyhq/shared/src/errors';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { AirGapQrcodeDialogContainer } from './AirGapQrcodeDialogContainer';

const mockShowToast = jest.fn<
  { close: () => Promise<void> },
  [{ onConfirm: () => Promise<void> }]
>(() => ({ close: async () => {} }));
const mockStartScan = jest.fn<Promise<unknown>, [unknown]>();
const mockResolve = jest.fn(async (_params: unknown) => undefined);
const mockReject = jest.fn(async (_params: unknown) => undefined);
const mockHold = jest.fn<(() => void) | undefined, [unknown]>();
let mockSignal: AbortSignal | undefined;

jest.mock('@onekeyhq/components', () => ({ resetScanModalRoute: jest.fn() }));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePromise: {
      resolveCallback: (params: unknown) => mockResolve(params),
      rejectCallback: (params: unknown) => mockReject(params),
    },
  },
}));
jest.mock('../../../components/SecureQRToast', () => ({
  SecureQRToast: {
    show: (...args: Parameters<typeof mockShowToast>) => mockShowToast(...args),
  },
}));
jest.mock('../../../views/ScanQrCode/hooks/useScanQrCodeLazy', () => ({
  __esModule: true,
  default: () => ({ start: mockStartScan }),
}));
jest.mock('../../../views/ScanQrCode/utils/getAccountIdOnNetwork', () => ({
  getAddressCreationRequestState: () => 'active',
  getAddressCreationRequestSignal: () => mockSignal,
  holdAddressCreationForChildScan: (request: unknown) => mockHold(request),
}));

it.each([false, true])(
  'closes only the linked address child when the owner aborts (%s)',
  async (aborted) => {
    jest.clearAllMocks();
    const controller = new AbortController();
    mockSignal = controller.signal;
    const release = jest.fn();
    mockHold.mockReturnValueOnce(release);
    let finishScan: (result: unknown) => void = () => {};
    let markScanStarted: () => void = () => {};
    const scanStarted = new Promise<void>((resolve) => {
      markScanStarted = resolve;
    });
    mockStartScan.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishScan = resolve;
          markScanStarted();
        }),
    );
    render(<AirGapQrcodeDialogContainer />);
    const addressCreationRequest = { nodeId: appEventBus.nodeId, id: 'parent' };
    appEventBus.emit(EAppEventBusNames.ShowAirGapQrcode, {
      valueUr:
        {} as IAppEventBusPayload[EAppEventBusNames.ShowAirGapQrcode]['valueUr'],
      promiseId: 41,
      addressCreationRequest,
    });
    const [{ onConfirm }] = mockShowToast.mock.calls[0];
    const confirmation = onConfirm();
    await scanStarted;
    expect(mockHold).toHaveBeenCalledWith(addressCreationRequest);
    expect(mockHold.mock.invocationCallOrder[0]).toBeLessThan(
      mockStartScan.mock.invocationCallOrder[0],
    );
    expect(mockStartScan).toHaveBeenCalledWith(
      expect.objectContaining({
        scanRequestId: 'air-gap:41',
        autoExecuteParsedAction: false,
      }),
    );

    if (aborted) controller.abort();
    const scanResult = { raw: 'simulated device response' };
    finishScan(scanResult);
    await confirmation;
    expect(release).toHaveBeenCalledTimes(1);
    if (aborted) {
      expect(resetScanModalRoute).toHaveBeenCalledWith({
        scanRequestId: 'air-gap:41',
      });
      expect(mockReject).toHaveBeenCalledWith({
        id: 41,
        error: expect.any(OneKeyErrorScanQrCodeCancel),
      });
      expect(mockResolve).not.toHaveBeenCalled();
    } else {
      expect(mockResolve).toHaveBeenCalledWith({ id: 41, data: scanResult });
      expect(mockReject).not.toHaveBeenCalled();
      expect(resetScanModalRoute).not.toHaveBeenCalled();
    }
    mockSignal = undefined;
  },
);
