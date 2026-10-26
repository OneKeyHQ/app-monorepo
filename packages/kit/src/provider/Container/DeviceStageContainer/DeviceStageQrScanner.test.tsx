/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DeviceStageQrScanner } from './DeviceStageQrScanner';

type IScanHandler = (value: string) => Promise<Record<string, unknown>>;

let mockScanHandler: IScanHandler | undefined;
const mockParse = jest.fn<Promise<unknown>, unknown[]>();
const mockCancelStageAirGapScan = jest.fn<Promise<void>, []>(
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
      cancelStageAirGapScan: () => mockCancelStageAirGapScan(),
      submitStageAirGapScanResult: jest.fn(async () => undefined),
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

it('ends the scan once for a code that can never be accepted', async () => {
  render(<DeviceStageQrScanner sessionId={1} />);
  mockParse.mockRejectedValue({ key: ETranslations.feedback_invalid_qr_code });

  await expect(scan('UR:BYTES/1-2/LPADAOCF')).resolves.toEqual({});
  await expect(scan('UR:BYTES/2-2/LPAOAOCF')).resolves.toEqual({});
  expect(mockCancelStageAirGapScan).toHaveBeenCalledTimes(1);
});
