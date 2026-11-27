/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { Dialog, resetAboveMainRoute } from '@onekeyhq/components';
import {
  OneKeyErrorScanQrCodeCancel,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ERootRoutes,
  EScanQrCodeModalPages,
  type IScanQrCodeModalParamList,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { isRetryableQrParseFailure } from '../utils/isInvalidQrCodeError';

import { parseQRCodeWithDeps } from './useParseQRCode';
import useScanQrCodeLazy from './useScanQrCodeLazy';

import type { IParseQRCodeRuntimeDeps } from './useParseQRCode';

const mockParse = jest.fn<Promise<unknown>, unknown[]>();
const mockGetCurrentRoute = jest.fn<
  { key: string; name: string } | undefined,
  []
>();
const mockGetRootState = jest.fn<unknown, []>();
type IScanRouteParams =
  IScanQrCodeModalParamList[EScanQrCodeModalPages.ScanQrCodeStack];

const mockPushModal = jest.fn<void, unknown[]>();
const mockPushScanModal = jest.fn<
  void,
  [string, { params: IScanRouteParams }]
>();
const mockPushUrlAccountPage = jest.fn<
  Promise<boolean>,
  [IParseQRCodeRuntimeDeps['navigation'], unknown, () => boolean]
>();
const mockGetAccounts = jest.fn(async () => ({ accounts: [] }));
const mockCreateAddress = jest.fn(async () => undefined);
const mockResetScanModalRoute = jest.fn<
  void,
  [options?: { scanRequestId: string }]
>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
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
      resetAnimationData: jest.fn(),
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
  default: () => ({ pushModal: mockPushScanModal }),
}));
jest.mock('../../Home/pages/urlAccount/urlAccountUtils', () => ({
  urlAccountNavigation: {
    pushUrlAccountPage: (...args: Parameters<typeof mockPushUrlAccountPage>) =>
      mockPushUrlAccountPage(...args),
  },
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
  mockPushUrlAccountPage.mockReset();
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

it.each([
  ['the search screen', { key: 'search', name: 'UniversalSearch' }, 0],
  ['the last main screen', { key: 'home', name: 'TabHome' }, 1],
] as const)(
  'checks whether Copy belongs on %s after dismissal',
  async (_, route, copyCount) => {
    mockGetCurrentRoute.mockReturnValue({
      key: 'scan',
      name: EScanQrCodeModalPages.ScanQrCodeStack,
    });
    mockGetRootState.mockReturnValue({
      routes: [
        { name: ERootRoutes.Main, state: { routes: [{ key: 'old-home' }] } },
        { name: ERootRoutes.Main, state: { routes: [{ key: 'home' }] } },
      ],
    });
    mockParse.mockResolvedValueOnce({
      type: EQRCodeHandlerType.BITCOIN,
      data: {},
    });
    const wait = jest
      .spyOn(timerUtils, 'wait')
      .mockImplementationOnce(async () => {
        mockGetCurrentRoute.mockReturnValue(route);
      });
    try {
      await parseQRCodeWithDeps(
        'scanned payment code',
        { popNavigation: true, autoExecuteParsedAction: true },
        deps,
      );
      expect(resetAboveMainRoute).toHaveBeenCalledTimes(1);
      expect(Dialog.confirm).toHaveBeenCalledTimes(copyCount);
    } finally {
      wait.mockRestore();
    }
  },
);

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

it('drops a manual address result if the user removes the scanner while parsing', async () => {
  const pending = Promise.withResolvers<{
    type: EQRCodeHandlerType;
    data: { address: string };
  }>();
  mockGetCurrentRoute.mockReturnValue({
    key: 'scan',
    name: EScanQrCodeModalPages.ScanQrCodeStack,
  });
  mockParse.mockReturnValueOnce(pending.promise);
  const onResultDismiss = jest.fn(() => true);
  const result = parseQRCodeWithDeps(
    'recipient',
    { popNavigation: true, autoExecuteParsedAction: false },
    { ...deps, scanRouteKey: 'scan', onResultDismiss },
  );

  mockGetCurrentRoute.mockReturnValue({ key: 'send', name: 'Send' });
  pending.resolve({
    type: EQRCodeHandlerType.BITCOIN,
    data: { address: 'recipient' },
  });

  await expect(result).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
  expect(onResultDismiss).not.toHaveBeenCalled();
  expect(mockResetScanModalRoute).not.toHaveBeenCalled();
});

it.each(['before parsing', 'during parsing'])(
  'returns a later manual scan result when the scanner is covered %s',
  async (when) => {
    const scan = { key: 'scan', name: EScanQrCodeModalPages.ScanQrCodeStack };
    const cover = { key: 'cover', name: 'Settings' };
    mockGetCurrentRoute.mockReturnValue(
      when === 'before parsing' ? cover : scan,
    );
    const { result: hook } = renderHook(() => useScanQrCodeLazy());
    const result = hook.current.start({});
    const { callback } = mockPushScanModal.mock.calls[0][1].params;
    const frame = {
      value: 'recipient',
      routeKey: scan.key,
      popNavigation: true,
      onResultDismiss: jest.fn(() => true),
    };
    const parsed = {
      type: EQRCodeHandlerType.BITCOIN,
      data: { address: 'recipient' },
    };
    if (when === 'during parsing') {
      mockParse.mockImplementationOnce(async () => {
        mockGetCurrentRoute.mockReturnValue(cover);
        return parsed;
      });
    }

    await expect(callback(frame)).resolves.toEqual({ retry: true });
    expect(frame.onResultDismiss).not.toHaveBeenCalled();

    mockGetCurrentRoute.mockReturnValue(scan);
    mockParse.mockResolvedValueOnce(parsed);
    await callback(frame);

    await expect(result).resolves.toEqual(parsed);
    expect(frame.onResultDismiss).toHaveBeenCalledTimes(1);
  },
);

it('an abandoned camera cannot dismiss the scanner or deliver a completed UR', async () => {
  const scan = { key: 'scan', name: EScanQrCodeModalPages.ScanQrCodeStack };
  mockGetCurrentRoute.mockReturnValue(scan);
  const { result: hook } = renderHook(() => useScanQrCodeLazy());
  const result = hook.current.start({});
  const settled = jest.fn();
  void result.then(settled);
  const { callback } = mockPushScanModal.mock.calls[0][1].params;
  const isCaptureCurrent = jest.fn(() => true);
  const onResultDismiss = jest.fn(() => true);
  mockParse.mockImplementationOnce(async () => {
    isCaptureCurrent.mockReturnValue(false);
    return {
      type: EQRCodeHandlerType.ANIMATION_CODE,
      data: { fullData: 'UR:BYTES/RETIRED' },
    };
  });
  const frame = { routeKey: scan.key, popNavigation: true, onResultDismiss };
  await expect(
    callback({ ...frame, value: 'UR:BYTES/LAST-PART', isCaptureCurrent }),
  ).resolves.toEqual({ retry: true });
  expect(onResultDismiss).not.toHaveBeenCalled();
  expect(mockResetScanModalRoute).not.toHaveBeenCalled();
  expect(settled).not.toHaveBeenCalled();

  const parsed = { type: EQRCodeHandlerType.BITCOIN, data: { address: 'new' } };
  mockParse.mockResolvedValueOnce(parsed);
  await callback({ ...frame, value: 'new' });
  await expect(result).resolves.toEqual(parsed);
});

it.each([true, false])(
  'settles a URL-account scan after navigation accepts dismissal: %s',
  async (acceptsDismissal) => {
    const scan = { key: 'scan', name: EScanQrCodeModalPages.ScanQrCodeStack };
    mockGetCurrentRoute.mockReturnValue(scan);
    const parsed = {
      type: EQRCodeHandlerType.URL_ACCOUNT,
      data: { networkId: 'evm--1', address: 'recipient' },
    };
    mockParse.mockResolvedValueOnce(parsed);
    const lookup = Promise.withResolvers<void>();
    const navigationStarted = Promise.withResolvers<void>();
    mockPushUrlAccountPage.mockImplementationOnce(
      async (_navigation, _params, shouldNavigate) => {
        navigationStarted.resolve();
        await lookup.promise;
        return shouldNavigate();
      },
    );
    const { result: hook } = renderHook(() => useScanQrCodeLazy());
    const result = hook.current.start({ autoExecuteParsedAction: true });
    const settled = jest.fn();
    void result.then(settled, settled);
    const { callback, onCancel } = mockPushScanModal.mock.calls[0][1].params;
    const onResultDismiss = jest.fn(() => acceptsDismissal);
    const frame = callback({
      value: 'account URL',
      routeKey: scan.key,
      popNavigation: true,
      onResultDismiss,
    });

    await navigationStarted.promise;
    expect(settled).not.toHaveBeenCalled();
    expect(onResultDismiss).not.toHaveBeenCalled();
    if (!acceptsDismissal) onCancel();
    lookup.resolve();

    if (acceptsDismissal) {
      await expect(frame).resolves.toEqual({});
      await expect(result).resolves.toEqual(parsed);
    } else {
      await expect(frame).resolves.toEqual({ retry: true });
      await expect(result).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
    }
  },
);
