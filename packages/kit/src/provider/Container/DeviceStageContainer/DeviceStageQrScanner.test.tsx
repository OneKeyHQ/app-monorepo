/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { DeviceStageQrScanner } from './DeviceStageQrScanner';

type IScanHandler = (value: string) => Promise<Record<string, unknown>>;

let mockScanHandler: IScanHandler | undefined;
const mockParse = jest.fn<Promise<unknown>, unknown[]>();
const mockCancelStageAirGapScan = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);
const mockSubmitStageAirGapScanResult = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);

jest.mock('@onekeyhq/components', () => ({
  Haptics: { impact: jest.fn() },
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceScanQRCode: {
      resetAnimationData: jest.fn(async () => undefined),
      parse: (...args: unknown[]) => mockParse(...args),
    },
    serviceQrWallet: {
      cancelStageAirGapScan: (params: unknown) =>
        mockCancelStageAirGapScan(params),
      submitStageAirGapScanResult: (params: unknown) =>
        mockSubmitStageAirGapScanResult(params),
    },
  },
}));
jest.mock('../../../views/ScanQrCode/components', () => ({
  ScanQrCode: ({
    handleBarCodeScanned,
  }: {
    handleBarCodeScanned: IScanHandler;
  }) => {
    mockScanHandler = handleBarCodeScanned;
    return null;
  },
}));

function scan(value: string) {
  if (!mockScanHandler) throw new OneKeyLocalError('scanner was not rendered');
  return mockScanHandler(value);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockScanHandler = undefined;
});

it('retries the frame after a transient parse failure without ending the scan', async () => {
  render(<DeviceStageQrScanner sessionId={1} />);
  mockParse.mockRejectedValueOnce(new OneKeyLocalError('bridge hiccup'));

  await expect(scan('UR:BYTES/1-2/LPADAOCF')).resolves.toEqual({
    retry: true,
  });
  expect(mockCancelStageAirGapScan).not.toHaveBeenCalled();
});

it('retries the assembled result when the encoder advances past the completing frame', async () => {
  render(<DeviceStageQrScanner sessionId={1} />);
  const frame = 'UR:BYTES/2-2/LPAOAOCF';
  const fullData = 'UR:BYTES/IEHSSALTTN';
  const completed = {
    type: EQRCodeHandlerType.ANIMATION_CODE,
    raw: frame,
    data: { fullData, progress: 1 },
  };
  mockParse.mockResolvedValueOnce(completed);
  mockSubmitStageAirGapScanResult.mockRejectedValueOnce(
    new OneKeyLocalError('bridge hiccup'),
  );

  await expect(scan(frame)).resolves.toEqual({ retry: true });
  await expect(scan('UR:BYTES/3-2/LPAXAOCF')).resolves.toEqual({});
  await expect(scan('UR:BYTES/4-2/LPAAAOCF')).resolves.toEqual({});

  const submission = {
    result: { ...completed, raw: fullData },
    sessionId: 1,
  };
  expect(mockParse).toHaveBeenCalledTimes(1);
  expect(mockSubmitStageAirGapScanResult.mock.calls).toEqual([
    [submission],
    [submission],
  ]);
});

it('ends the scan once for a code that can never be accepted', async () => {
  render(<DeviceStageQrScanner sessionId={1} />);
  mockParse.mockRejectedValue({ key: ETranslations.feedback_invalid_qr_code });

  await expect(scan('UR:BYTES/1-2/LPADAOCF')).resolves.toEqual({});
  await expect(scan('UR:BYTES/2-2/LPAOAOCF')).resolves.toEqual({});
  expect(mockCancelStageAirGapScan).toHaveBeenCalledTimes(1);
  expect(mockCancelStageAirGapScan).toHaveBeenCalledWith({
    scanning: true,
    sessionId: 1,
  });
});

it('drops a parse that settles after the scanner unmounted', async () => {
  const { unmount } = render(<DeviceStageQrScanner sessionId={1} />);
  let rejectParse: (error: unknown) => void = () => undefined;
  mockParse.mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      rejectParse = reject;
    }),
  );

  const pending = scan('UR:BYTES/1-2/LPADAOCF');
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(mockParse).toHaveBeenCalledTimes(1);
  unmount();
  rejectParse({ key: ETranslations.feedback_invalid_qr_code });

  await expect(pending).resolves.toEqual({});
  expect(mockCancelStageAirGapScan).not.toHaveBeenCalled();
});
