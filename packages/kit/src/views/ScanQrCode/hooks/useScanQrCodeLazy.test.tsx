/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { OneKeyErrorScanQrCodeCancel } from '@onekeyhq/shared/src/errors';
import type {
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList,
} from '@onekeyhq/shared/src/routes';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import useScanQrCode from './useScanQrCode';
import useScanQrCodeLazy from './useScanQrCodeLazy';

const mockParse = jest.fn<Promise<unknown>, unknown[]>();
const mockPushModal = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

jest.mock('@onekeyhq/components', () => ({
  useClipboard: jest.fn(),
}));
jest.mock('react-intl', () => ({ useIntl: jest.fn() }));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceScanQRCode: { resetAnimationData: jest.fn() } },
}));
jest.mock('./useParseQRCode', () => ({
  __esModule: true,
  default: () => ({ parse: (...args: unknown[]) => mockParse(...args) }),
  parseQRCodeWithDeps: (...args: unknown[]) => mockParse(...args),
}));

type IScanParams =
  IScanQrCodeModalParamList[EScanQrCodeModalPages.ScanQrCodeStack];

test('a hidden scanner can still return a recipient after regaining focus', async () => {
  const { result } = renderHook(useScanQrCodeLazy);
  const scanning = result.current.start({});
  const settled = jest.fn();
  void scanning.then(settled, settled);
  const { params } = mockPushModal.mock.calls[0][1] as { params: IScanParams };
  const firstFrame = {
    value: 'first invoice',
    popNavigation: true,
    canApplyScanResult: () => false,
    isScanOpen: () => true,
  };
  mockParse.mockRejectedValueOnce(new OneKeyErrorScanQrCodeCancel());
  await expect(params.callback(firstFrame)).resolves.toEqual({ retry: true });
  expect(settled).not.toHaveBeenCalled();

  const nextResult = {
    type: EQRCodeHandlerType.LIGHTNING_NETWORK,
    raw: 'next invoice',
  };
  mockParse.mockResolvedValueOnce(nextResult);
  const onResultWillClose = jest.fn();
  await params.callback({
    ...firstFrame,
    value: nextResult.raw,
    canApplyScanResult: () => true,
    onResultWillClose,
  });
  expect(mockParse).toHaveBeenLastCalledWith(
    nextResult.raw,
    expect.anything(),
    expect.objectContaining({ onResultWillClose }),
  );
  await expect(scanning).resolves.toEqual(nextResult);
});

test('closing the scanner ends a pending recipient scan', async () => {
  const { result } = renderHook(useScanQrCodeLazy);
  const scanning = result.current.start({});
  const { params } = mockPushModal.mock.calls[0][1] as { params: IScanParams };
  await Promise.all([
    expect(scanning).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel),
    expect(
      params.callback({
        value: '',
        popNavigation: false,
      }),
    ).resolves.toEqual({}),
  ]);
});

test.each([useScanQrCode, useScanQrCodeLazy])(
  '%p still returns the photo when a stale camera result finishes during dismissal',
  async (useScan) => {
    const { result } = renderHook(useScan);
    const scanning = result.current.start({});
    const settled = jest.fn();
    void scanning.then(settled, settled);
    const { params } = mockPushModal.mock.calls[0][1] as {
      params: IScanParams;
    };
    let finishCamera: (error: unknown) => void = () => {};
    mockParse.mockReturnValueOnce(
      new Promise((_, reject) => {
        finishCamera = reject;
      }),
    );
    let isScanOpen = true;
    const parseCamera = params.callback({
      value: 'old camera invoice',
      popNavigation: true,
      isScanOpen: () => isScanOpen,
    });
    let finishPhoto: (value: unknown) => void = () => {};
    mockParse.mockReturnValueOnce(
      new Promise((resolve) => {
        finishPhoto = resolve;
      }),
    );
    const parsePhoto = params.callback({
      value: 'new photo invoice',
      popNavigation: true,
      isScanOpen: () => isScanOpen,
    });
    isScanOpen = false;
    finishCamera(new OneKeyErrorScanQrCodeCancel());
    await expect(parseCamera).resolves.toEqual({});
    expect(settled).not.toHaveBeenCalled();

    const resultFromPhoto = {
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
      raw: 'new photo invoice',
    };
    finishPhoto(resultFromPhoto);
    await parsePhoto;
    await expect(scanning).resolves.toEqual(resultFromPhoto);
  },
);
