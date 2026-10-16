import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { isRetryableQrParseFailure } from '../utils/isInvalidQrCodeError';

import { parseQRCodeWithDeps } from './useParseQRCode';

import type { IParseQRCodeRuntimeDeps } from './useParseQRCode';

const mockParse = jest.fn<Promise<unknown>, unknown[]>();
const mockResetScanModalRoute = jest.fn<void, []>();

jest.mock('@onekeyhq/components', () => ({
  Dialog: { confirm: jest.fn() },
  Toast: { error: jest.fn(), success: jest.fn() },
  rootNavigationRef: { current: undefined },
  useClipboard: jest.fn(),
  resetAboveMainRoute: jest.fn(),
  resetScanModalRoute: () => mockResetScanModalRoute(),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceScanQRCode: {
      parse: (...args: unknown[]) => mockParse(...args),
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

it('closes the scan page for a code that can never be accepted', async () => {
  const invalid = { key: ETranslations.feedback_invalid_qr_code };
  mockParse.mockRejectedValueOnce(invalid);

  await expect(parseFrame()).rejects.toBe(invalid);
  expect(mockResetScanModalRoute).toHaveBeenCalledTimes(1);
  expect(isRetryableQrParseFailure(invalid)).toBe(false);
});
