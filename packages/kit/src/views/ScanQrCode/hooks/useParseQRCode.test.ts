import { Dialog, resetAboveMainRoute } from '@onekeyhq/components';
import {
  OneKeyErrorScanQrCodeCancel,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ERootRoutes,
  EScanQrCodeModalPages,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { isRetryableQrParseFailure } from '../utils/isInvalidQrCodeError';

import { parseQRCodeWithDeps } from './useParseQRCode';

import type { IParseQRCodeRuntimeDeps } from './useParseQRCode';

const mockParse = jest.fn<Promise<unknown>, unknown[]>();
const mockGetCurrentRoute = jest.fn<
  { key: string; name: string } | undefined,
  []
>();
const mockGetRootState = jest.fn<unknown, []>();
const mockPushModal = jest.fn<void, unknown[]>();
const mockGetAccounts = jest.fn(async () => ({ accounts: [] }));
const mockCreateAddress = jest.fn(async () => undefined);
const mockResetScanModalRoute = jest.fn<
  void,
  [options?: { scanRequestId: string }]
>();

jest.mock('@onekeyhq/components', () => ({
  Dialog: { confirm: jest.fn() },
  Toast: { error: jest.fn(), success: jest.fn() },
  rootNavigationRef: {
    current: {
      getCurrentRoute: () => mockGetCurrentRoute(),
      getRootState: () => mockGetRootState(),
    },
  },
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
      getNativeToken: async () => null,
    },
    serviceAccount: {
      getAccountsInSameIndexedAccountId: () => mockGetAccounts(),
      createAddressIfNotExists: () => mockCreateAddress(),
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
  mockGetCurrentRoute.mockReset();
  mockGetRootState.mockReset();
});

it.each([
  [false, EQRCodeHandlerType.LIGHTNING_NETWORK],
  [false, EQRCodeHandlerType.UNKNOWN],
  [true, EQRCodeHandlerType.UNKNOWN],
])(
  'cancels a replaced Lightning scan in automatic mode %s with result %s',
  async (autoExecuteParsedAction, type) => {
    mockGetCurrentRoute.mockReturnValue({
      key: 'new',
      name: EScanQrCodeModalPages.ScanQrCodeStack,
    });
    mockParse.mockResolvedValueOnce({
      type,
      data: {},
    });
    await expect(
      parseQRCodeWithDeps(
        'lightning:alice@example.com',
        { popNavigation: true, autoExecuteParsedAction },
        { ...deps, scanRouteKey: 'old' },
      ),
    ).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
    expect(mockResetScanModalRoute).not.toHaveBeenCalled();
    expect(resetAboveMainRoute).not.toHaveBeenCalled();
    expect(Dialog.confirm).not.toHaveBeenCalled();
  },
);

it('leaves a later screen alone when the no-account scan has already closed', async () => {
  mockGetCurrentRoute.mockReturnValueOnce({
    key: 'scan',
    name: EScanQrCodeModalPages.ScanQrCodeStack,
  });
  mockGetCurrentRoute.mockReturnValue({ key: 'next', name: 'Settings' });
  mockParse.mockResolvedValueOnce({
    type: EQRCodeHandlerType.LIGHTNING_NETWORK,
    data: {},
  });
  await expect(
    parseQRCodeWithDeps(
      'scanned payment code',
      { popNavigation: true, autoExecuteParsedAction: true },
      deps,
    ),
  ).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
  expect(resetAboveMainRoute).not.toHaveBeenCalled();
  expect(Dialog.confirm).not.toHaveBeenCalled();
});

it.each([
  ['the home tab stays active', { key: 'home', name: 'TabHome' }, 1],
  ['another tab takes focus', { key: 'market', name: 'TabMarket' }, 0],
])(
  'handles a Lightning scan when %s during dismissal',
  async (_, route, count) => {
    const home = { key: 'home', name: 'TabHome' };
    const scan = { key: 'scan', name: EScanQrCodeModalPages.ScanQrCodeStack };
    mockGetCurrentRoute.mockReturnValue(scan);
    mockGetRootState.mockReturnValue({
      index: 1,
      routes: [
        { name: ERootRoutes.Main, state: { routes: [home], index: 0 } },
        scan,
      ],
    });
    mockParse.mockResolvedValueOnce({
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
      data: { address: 'recipient', network: { id: 'lightning--0' } },
    });
    const wait = jest
      .spyOn(timerUtils, 'wait')
      .mockImplementationOnce(async () => {
        mockGetCurrentRoute.mockReturnValue(route);
      });
    try {
      await parseQRCodeWithDeps(
        'scanned payment code',
        {
          popNavigation: true,
          autoExecuteParsedAction: true,
          account: { id: 'lightning-account' } as NonNullable<
            NonNullable<Parameters<typeof parseQRCodeWithDeps>[1]>['account']
          >,
        },
        {
          ...deps,
          navigation: { ...deps.navigation, pushModal: mockPushModal },
        },
      );
      expect(resetAboveMainRoute).toHaveBeenCalledTimes(1);
      expect(mockPushModal).toHaveBeenCalledTimes(count);
    } finally {
      wait.mockRestore();
    }
  },
);

it('keeps the scan page open after a transient parse failure', async () => {
  const transient = new OneKeyLocalError('bridge hiccup');
  mockParse.mockRejectedValueOnce(transient);

  await expect(parseFrame()).rejects.toBe(transient);
  expect(mockResetScanModalRoute).not.toHaveBeenCalled();
  expect(isRetryableQrParseFailure(transient)).toBe(true);
});

it('keeps Copy off the search screen opened during scanner dismissal', async () => {
  mockGetCurrentRoute.mockReturnValue({
    key: 'scan',
    name: EScanQrCodeModalPages.ScanQrCodeStack,
  });
  mockGetRootState.mockReturnValue({
    routes: [{ name: ERootRoutes.Main, state: { routes: [{ key: 'home' }] } }],
  });
  mockParse.mockResolvedValueOnce({
    type: EQRCodeHandlerType.BITCOIN,
    data: {},
  });
  const wait = jest
    .spyOn(timerUtils, 'wait')
    .mockImplementationOnce(async () => {
      mockGetCurrentRoute.mockReturnValue({
        key: 'search',
        name: 'UniversalSearch',
      });
    });
  try {
    await parseQRCodeWithDeps(
      'scanned payment code',
      { popNavigation: true, autoExecuteParsedAction: true },
      deps,
    );
    expect(resetAboveMainRoute).toHaveBeenCalledTimes(1);
    expect(Dialog.confirm).not.toHaveBeenCalled();
  } finally {
    wait.mockRestore();
  }
});

it('closes the scan page for a code that can never be accepted', async () => {
  const invalid = { key: ETranslations.feedback_invalid_qr_code };
  mockParse.mockRejectedValueOnce(invalid);

  await expect(parseFrame()).rejects.toBe(invalid);
  expect(mockResetScanModalRoute).toHaveBeenCalledTimes(1);
  expect(isRetryableQrParseFailure(invalid)).toBe(false);
});

it.each([
  [
    'a lightning invoice without an active account',
    EQRCodeHandlerType.LIGHTNING_NETWORK,
    undefined,
  ],
  [
    'a bitcoin address without an active account',
    EQRCodeHandlerType.BITCOIN,
    undefined,
  ],
  [
    'a lightning invoice on a QR wallet',
    EQRCodeHandlerType.LIGHTNING_NETWORK,
    {
      id: 'qr-test--evm',
      impl: 'evm',
      indexedAccountId: 'qr-test--0',
    } as INetworkAccount,
  ],
] as const)(
  'copies %s without starting account creation',
  async (_label, type, account) => {
    const value = 'scanned payment code';
    mockParse.mockResolvedValueOnce({
      type,
      data: {
        address: 'recipient',
        network: { id: 'network--0', impl: 'lightning' },
      },
      raw: value,
    });

    await parseQRCodeWithDeps(
      value,
      { popNavigation: true, autoExecuteParsedAction: true, account },
      deps,
    );

    expect(resetAboveMainRoute).toHaveBeenCalledTimes(1);
    expect(mockCreateAddress).not.toHaveBeenCalled();
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
