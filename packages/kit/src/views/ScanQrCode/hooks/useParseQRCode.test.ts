import { Dialog, resetAboveMainRoute } from '@onekeyhq/components';
import {
  OneKeyErrorScanQrCodeCancel,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { isRetryableQrParseFailure } from '../utils/isInvalidQrCodeError';

import { parseQRCodeWithDeps } from './useParseQRCode';

import type { IParseQRCodeRuntimeDeps } from './useParseQRCode';

const mockParse = jest.fn<Promise<unknown>, unknown[]>();
const mockGetNativeToken = jest.fn<Promise<unknown>, unknown[]>();
const mockResetScanModalRoute = jest.fn<
  void,
  [options?: { scanRequestId: string }]
>();

jest.mock('@onekeyhq/components', () => ({
  Dialog: { confirm: jest.fn() },
  Toast: { error: jest.fn(), success: jest.fn() },
  rootNavigationRef: { current: undefined },
  useClipboard: jest.fn(),
  resetAboveMainRoute: jest.fn(),
  resetScanModalRoute: (options?: { scanRequestId: string }) =>
    mockResetScanModalRoute(options),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceScanQRCode: {
      parse: (...args: unknown[]) => mockParse(...args),
    },
    serviceNetwork: {
      getVaultSettings: async () => ({ isSingleToken: true }),
    },
    serviceToken: {
      getNativeToken: (...args: unknown[]) => mockGetNativeToken(...args),
    },
  },
}));
jest.mock(
  '@onekeyhq/kit/src/components/WalletConnect/connectWalletConnectToDapp',
  () => ({ connectWalletConnectToDapp: jest.fn() }),
);
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../Home/pages/urlAccount/urlAccountUtils', () => ({
  urlAccountNavigation: {},
}));
jest.mock('../../Market/marketUtils', () => ({ marketNavigation: {} }));
jest.mock('../../WalletConnectPay/dialog/wcPayDialogStore', () => ({
  openWcPayDialog: jest.fn(),
}));

const deps = {
  navigation: {},
  clipboard: {},
  intl: { formatMessage: ({ id }: { id: string }) => id },
} as unknown as IParseQRCodeRuntimeDeps;

function parseFrame() {
  return parseQRCodeWithDeps(
    'UR:BYTES/1-2/LPADAOCF',
    { popNavigation: true, autoExecuteParsedAction: false },
    deps,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('keeps the scan page open after a transient parse failure', async () => {
  const transient = new OneKeyLocalError('bridge hiccup');
  mockParse.mockRejectedValueOnce(transient);

  await expect(parseFrame()).rejects.toBe(transient);
  expect(mockResetScanModalRoute).not.toHaveBeenCalled();
  expect(isRetryableQrParseFailure(transient)).toBe(true);
});

it.each([
  ETranslations.feedback_invalid_qr_code,
  ETranslations.send_the_invoice_has_expired,
])('closes the scan page for a terminal QR code error (%s)', async (key) => {
  const invalid = { key };
  mockParse.mockRejectedValueOnce(invalid);

  await expect(parseFrame()).rejects.toBe(invalid);
  expect(mockResetScanModalRoute).toHaveBeenCalledTimes(1);
  expect(isRetryableQrParseFailure(invalid)).toBe(false);
});

it.each([
  ['a lightning invoice', EQRCodeHandlerType.LIGHTNING_NETWORK],
  ['a bitcoin address', EQRCodeHandlerType.BITCOIN],
])(
  'hands %s back when there is no account to send from',
  async (_label, type) => {
    const value = 'scanned payment code';
    mockParse.mockResolvedValueOnce({
      type,
      data: { address: 'recipient', network: { id: 'network--0' } },
      raw: value,
    });

    await parseQRCodeWithDeps(
      value,
      { popNavigation: true, autoExecuteParsedAction: true },
      deps,
    );

    expect(resetAboveMainRoute).toHaveBeenCalledTimes(1);
    expect(Dialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ description: value }),
    );
  },
);

it('keeps a late parse failure scoped to the scanner that produced it', async () => {
  const invalid = { key: ETranslations.feedback_invalid_qr_code };
  mockParse.mockRejectedValueOnce(invalid);
  await expect(
    parseQRCodeWithDeps(
      'UR:BYTES/old',
      { popNavigation: true, autoExecuteParsedAction: false },
      { ...deps, scanRequestId: 'old-scan' },
    ),
  ).rejects.toBe(invalid);
  expect(mockResetScanModalRoute).toHaveBeenCalledWith({
    scanRequestId: 'old-scan',
  });
});

it('marks result-driven navigation before removing the scanner', async () => {
  const result = {
    type: EQRCodeHandlerType.LIGHTNING_NETWORK,
    data: { address: 'invoice' },
    raw: 'invoice',
  };
  mockParse.mockResolvedValueOnce(result);
  const onResultWillClose = jest.fn();
  mockResetScanModalRoute.mockImplementationOnce(() => {
    expect(onResultWillClose).toHaveBeenCalledTimes(1);
  });

  await expect(
    parseQRCodeWithDeps(
      'invoice',
      { popNavigation: true, autoExecuteParsedAction: false },
      { ...deps, onResultWillClose },
    ),
  ).resolves.toBe(result);
  expect(mockResetScanModalRoute).toHaveBeenCalledTimes(1);
});

it('discards a payment code that finishes parsing after its scanner closes', async () => {
  const controller = new AbortController();
  let completeParse: (result: unknown) => void = () => {};
  mockParse.mockReturnValueOnce(
    new Promise((resolve) => {
      completeParse = resolve;
    }),
  );
  const parsing = parseQRCodeWithDeps(
    'lightning:lnurl',
    { popNavigation: true, autoExecuteParsedAction: true },
    { ...deps, canApplyScanResult: () => !controller.signal.aborted },
  );

  controller.abort();
  completeParse({
    type: EQRCodeHandlerType.LIGHTNING_NETWORK,
    data: { network: { id: 'lightning--0' } },
    raw: 'lightning:lnurl',
  });

  await expect(parsing).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
  expect(resetAboveMainRoute).not.toHaveBeenCalled();
  expect(Dialog.confirm).not.toHaveBeenCalled();
});

it('does not reset navigation when a payment lookup finishes after closing the scanner', async () => {
  const pushModal = jest.fn();
  const controller = new AbortController();
  let finishLookup: (token: unknown) => void = () => {};
  let lookupStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    lookupStarted = resolve;
  });
  mockGetNativeToken.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishLookup = resolve;
        lookupStarted();
      }),
  );
  mockParse.mockResolvedValueOnce({
    type: EQRCodeHandlerType.LIGHTNING_NETWORK,
    data: {
      address: 'invoice',
      network: { id: 'lightning--0', impl: 'lightning' },
    },
    raw: 'invoice',
  });
  const parsing = parseQRCodeWithDeps(
    'invoice',
    {
      popNavigation: true,
      autoExecuteParsedAction: true,
      account: {
        id: 'test-account',
        impl: 'lightning',
      } as NonNullable<Parameters<typeof parseQRCodeWithDeps>[1]>['account'],
    },
    {
      ...deps,
      navigation: { ...deps.navigation, pushModal },
      canApplyScanResult: () => !controller.signal.aborted,
    },
  );

  await started;
  controller.abort();
  finishLookup({ networkId: 'lightning--0' });

  await expect(parsing).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
  expect(resetAboveMainRoute).not.toHaveBeenCalled();
  expect(pushModal).not.toHaveBeenCalled();
});
