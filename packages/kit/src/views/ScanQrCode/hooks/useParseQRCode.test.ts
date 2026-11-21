import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  Dialog,
  Toast,
  navigateFromOverlayToTab,
  resetAboveMainRoute,
} from '@onekeyhq/components';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import ServiceNetwork from '@onekeyhq/kit-bg/src/services/ServiceNetwork/ServiceNetwork';
import lightningSettings from '@onekeyhq/kit-bg/src/vaults/impls/lightning/settings';
import {
  InvoiceExpiredError,
  OneKeyErrorScanQrCodeCancel,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { getAddressCreationRequestSignal } from '../utils/getAccountIdOnNetwork';
import { isRetryableQrParseFailure } from '../utils/isInvalidQrCodeError';

import { parseQRCodeWithDeps } from './useParseQRCode';

import type { IParseQRCodeRuntimeDeps } from './useParseQRCode';

const mockParse = jest.fn<Promise<unknown>, unknown[]>();
const mockEnsureLightningInvoiceIsCurrent = jest.fn<
  Promise<void>,
  [{ expiresAt: number }]
>(async () => undefined);
const mockGetNativeToken = jest.fn<Promise<unknown>, unknown[]>();
const mockGetNetworkSafe = jest.fn<Promise<unknown>, unknown[]>();
const mockCreateAddressIfNotExists = jest.fn<
  Promise<{ id: string } | undefined>,
  Parameters<IBackgroundApi['serviceAccount']['createAddressIfNotExists']>
>(async () => undefined);
const mockGetCompatibleNetworks = jest.fn<
  ReturnType<ServiceNetwork['getNetworkIdsCompatibleWithWalletId']>,
  Parameters<ServiceNetwork['getNetworkIdsCompatibleWithWalletId']>
>();
const mockResetScanModalRoute = jest.fn<
  void,
  [options?: { scanRequestId: string }]
>();

jest.mock('@react-navigation/native', () => ({
  StackActions: { push: jest.fn() },
}));
jest.mock('@onekeyhq/components', () => ({
  Dialog: { confirm: jest.fn() },
  Toast: { error: jest.fn(), success: jest.fn() },
  rootNavigationRef: { current: undefined },
  useClipboard: jest.fn(),
  resetAboveMainRoute: jest.fn(),
  navigateFromOverlayToTab: jest.fn(),
  resetScanModalRoute: (options?: { scanRequestId: string }) =>
    mockResetScanModalRoute(options),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceScanQRCode: {
      parse: (...args: unknown[]) => mockParse(...args),
      ensureLightningInvoiceIsCurrent: (params: { expiresAt: number }) =>
        mockEnsureLightningInvoiceIsCurrent(params),
    },
    serviceNetwork: {
      getVaultSettings: async () => ({ isSingleToken: true }),
      getNetworkSafe: (...args: unknown[]) => mockGetNetworkSafe(...args),
      getNetworkIdsCompatibleWithWalletId: (
        ...args: Parameters<typeof mockGetCompatibleNetworks>
      ) => mockGetCompatibleNetworks(...args),
    },
    serviceAccount: {
      getAccountsInSameIndexedAccountId: async () => ({ accounts: [] }),
      createAddressIfNotExists: (
        ...args: Parameters<typeof mockCreateAddressIfNotExists>
      ) => mockCreateAddressIfNotExists(...args),
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
  mockEnsureLightningInvoiceIsCurrent.mockReset().mockResolvedValue(undefined);
  mockCreateAddressIfNotExists.mockReset().mockResolvedValue(undefined);
  mockGetCompatibleNetworks.mockReset().mockResolvedValue({
    networkIdsCompatible: [],
    networkIdsIncompatible: [],
  });
});

it('gives the current result ownership of address creation within its scan scope', async () => {
  const network = { id: 'lightning--0', impl: 'lightning' };
  const scope = new AbortController();
  const otherScope = new AbortController();
  function holdNextAddressRequest() {
    const started = Promise.withResolvers<AbortSignal | undefined>();
    const response = Promise.withResolvers<undefined>();
    mockCreateAddressIfNotExists.mockImplementationOnce((_params, options) => {
      started.resolve(
        getAddressCreationRequestSignal(options.addressCreationRequest),
      );
      return response.promise;
    });
    return {
      started: started.promise,
      finish: () => response.resolve(undefined),
    };
  }
  function scan(
    address: string,
    scanScope: AbortController,
    canApplyScanResult = () => !scanScope.signal.aborted,
  ) {
    mockParse.mockResolvedValueOnce({
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
      data: { address, network },
    });
    return parseQRCodeWithDeps(
      address,
      {
        popNavigation: false,
        autoExecuteParsedAction: true,
        account: {
          id: 'hd-1--0',
          indexedAccountId: 'hd-1--0',
          impl: 'btc',
        } as NonNullable<Parameters<typeof parseQRCodeWithDeps>[1]>['account'],
      },
      {
        ...deps,
        scanSignal: scanScope.signal,
        canApplyScanResult,
      },
    );
  }

  const firstRequest = holdNextAddressRequest();
  let firstIsCurrent = true;
  const first = scan('first invoice', scope, () => firstIsCurrent).catch(
    (error: unknown) => error,
  );
  const firstSignal = await firstRequest.started;
  try {
    await expect(scan('another invoice', scope)).rejects.toBeInstanceOf(
      OneKeyErrorScanQrCodeCancel,
    );
    expect(mockCreateAddressIfNotExists).toHaveBeenCalledTimes(1);
    await scan('invoice from another scope', otherScope);
    expect(mockCreateAddressIfNotExists).toHaveBeenCalledTimes(2);

    firstIsCurrent = false;
    const replacementRequest = holdNextAddressRequest();
    const replacement = scan('replacement invoice', scope);
    try {
      await Promise.race([replacementRequest.started, replacement]);
      expect(mockCreateAddressIfNotExists).toHaveBeenCalledTimes(3);
      expect(firstSignal?.aborted).toBe(true);

      firstRequest.finish();
      await expect(first).resolves.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
      await expect(scan('another invoice', scope)).rejects.toBeInstanceOf(
        OneKeyErrorScanQrCodeCancel,
      );
      expect(mockCreateAddressIfNotExists).toHaveBeenCalledTimes(3);
    } finally {
      replacementRequest.finish();
    }
    await replacement;
  } finally {
    firstRequest.finish();
    await first;
  }
  await scan('invoice after cancellation', scope);
  expect(mockCreateAddressIfNotExists).toHaveBeenCalledTimes(4);
});

it.each([
  [EDeviceType.Pro2, false],
  [EDeviceType.Neo, false],
  [EDeviceType.Classic, true],
])(
  'routes the invoice according to the connected %s compatibility',
  async (deviceType, compatible) => {
    const network = { id: 'lightning--0', impl: 'lightning' };
    const service = Object.assign(Object.create(ServiceNetwork.prototype), {
      _getNetworkVaultSettingsByNetworkIds: async () => [
        { network, vaultSetting: lightningSettings },
      ],
      backgroundApi: {
        serviceAccount: {
          getWalletDeviceSafe: async () => ({ deviceType }),
          getWalletSafe: async () => undefined,
        },
      },
    }) as ServiceNetwork;
    mockGetCompatibleNetworks.mockImplementationOnce((params) =>
      service.getNetworkIdsCompatibleWithWalletId(params),
    );
    const pushModal = jest.fn();
    mockParse.mockResolvedValueOnce({
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
      data: { address: 'invoice', network },
    });
    if (compatible) {
      mockCreateAddressIfNotExists.mockResolvedValueOnce({
        id: 'hw-1--lightning',
      });
      mockGetNativeToken.mockResolvedValueOnce({
        networkId: network.id,
        decimals: 8,
      });
    }
    await parseQRCodeWithDeps(
      'lightning:invoice',
      {
        popNavigation: true,
        autoExecuteParsedAction: true,
        account: {
          id: 'hw-1--0',
          indexedAccountId: 'hw-1--0',
          impl: 'btc',
        } as NonNullable<Parameters<typeof parseQRCodeWithDeps>[1]>['account'],
      },
      { ...deps, navigation: { ...deps.navigation, pushModal } },
    );

    expect(mockCreateAddressIfNotExists).toHaveBeenCalledTimes(
      compatible ? 1 : 0,
    );
    expect(Dialog.confirm).toHaveBeenCalledTimes(compatible ? 0 : 1);
    expect(pushModal).toHaveBeenCalledTimes(compatible ? 1 : 0);
    expect(mockGetCompatibleNetworks).toHaveBeenCalledWith({
      walletId: 'hw-1',
      networkIds: [network.id],
    });
  },
);

it('rechecks a deferred invoice before offering to create a missing address', async () => {
  const expiresAt = 1_900_000_000;
  const picker = Promise.withResolvers<void>();
  const waiting = Promise.withResolvers<void>();
  const controller = new AbortController();
  mockParse.mockResolvedValueOnce({
    type: EQRCodeHandlerType.LIGHTNING_NETWORK,
    data: {
      address: 'invoice',
      network: { id: 'lightning--0', impl: 'lightning' },
      expiresAt,
    },
  });
  mockEnsureLightningInvoiceIsCurrent.mockRejectedValueOnce(
    new InvoiceExpiredError({ autoToast: false }),
  );
  const parsing = parseQRCodeWithDeps(
    'lightning:invoice',
    {
      popNavigation: true,
      autoExecuteParsedAction: true,
      account: {
        id: 'hd-1--0',
        indexedAccountId: 'hd-1--0',
        impl: 'btc',
      } as NonNullable<Parameters<typeof parseQRCodeWithDeps>[1]>['account'],
    },
    {
      ...deps,
      scanSignal: controller.signal,
      canApplyScanResult: () => true,
      waitForPhotoPicker: () => {
        waiting.resolve();
        return picker.promise;
      },
    },
  );
  await waiting.promise;
  expect(mockEnsureLightningInvoiceIsCurrent).not.toHaveBeenCalled();
  expect(mockCreateAddressIfNotExists).not.toHaveBeenCalled();

  picker.resolve();
  await expect(parsing).rejects.toBeInstanceOf(InvoiceExpiredError);
  expect(mockEnsureLightningInvoiceIsCurrent).toHaveBeenCalledWith({
    expiresAt,
  });
  expect(mockCreateAddressIfNotExists).not.toHaveBeenCalled();
  expect(Dialog.confirm).not.toHaveBeenCalled();
  expect(Toast.error).toHaveBeenCalledWith({
    title: ETranslations.send_the_invoice_has_expired,
  });
  expect(resetAboveMainRoute).toHaveBeenCalledTimes(1);
});

it('rechecks invoice expiry after a missing address is created and before opening Send', async () => {
  const expiresAt = 1_900_000_000;
  const creationStarted = Promise.withResolvers<void>();
  const creation = Promise.withResolvers<{ id: string }>();
  const pushModal = jest.fn();
  mockParse.mockResolvedValueOnce({
    type: EQRCodeHandlerType.LIGHTNING_NETWORK,
    data: {
      address: 'invoice',
      network: { id: 'lightning--0', impl: 'lightning' },
      expiresAt,
    },
  });
  mockCreateAddressIfNotExists.mockImplementationOnce(() => {
    creationStarted.resolve();
    return creation.promise;
  });
  mockGetNativeToken.mockResolvedValueOnce({
    networkId: 'lightning--0',
    decimals: 8,
  });
  mockEnsureLightningInvoiceIsCurrent.mockRejectedValueOnce(
    new InvoiceExpiredError({ autoToast: false }),
  );
  const parsing = parseQRCodeWithDeps(
    'lightning:invoice',
    {
      popNavigation: true,
      autoExecuteParsedAction: true,
      account: {
        id: 'hd-1--0',
        indexedAccountId: 'hd-1--0',
        impl: 'btc',
      } as NonNullable<Parameters<typeof parseQRCodeWithDeps>[1]>['account'],
    },
    { ...deps, navigation: { ...deps.navigation, pushModal } },
  );
  await creationStarted.promise;
  expect(mockEnsureLightningInvoiceIsCurrent).not.toHaveBeenCalled();
  creation.resolve({ id: 'hd-1--lightning' });
  await expect(parsing).rejects.toBeInstanceOf(InvoiceExpiredError);
  expect(mockGetNativeToken).toHaveBeenCalledTimes(1);
  expect(mockEnsureLightningInvoiceIsCurrent).toHaveBeenCalledWith({
    expiresAt,
  });
  expect(Toast.error).toHaveBeenCalledWith({
    title: ETranslations.send_the_invoice_has_expired,
  });
  expect(resetAboveMainRoute).toHaveBeenCalledTimes(1);
  expect(pushModal).not.toHaveBeenCalled();
});

it.each(['lightning--0', 'tlightning--0'])(
  'copies the invoice instead of trying to create a QR-wallet address on %s',
  async (networkId) => {
    const pushModal = jest.fn();
    mockParse.mockResolvedValueOnce({
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
      data: {
        address: 'invoice',
        network: { id: networkId, impl: networkId.split('--')[0] },
      },
    });
    await parseQRCodeWithDeps(
      'lightning:invoice',
      {
        popNavigation: true,
        autoExecuteParsedAction: true,
        account: {
          id: 'qr-1--0',
          indexedAccountId: 'qr-1--0',
          impl: 'btc',
        } as NonNullable<Parameters<typeof parseQRCodeWithDeps>[1]>['account'],
      },
      { ...deps, navigation: { ...deps.navigation, pushModal } },
    );

    expect(mockCreateAddressIfNotExists).not.toHaveBeenCalled();
    expect(Dialog.confirm).toHaveBeenCalled();
    expect(pushModal).not.toHaveBeenCalled();
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
  ETranslations.feedback_invalid_qr_code,
  ETranslations.send_the_invoice_has_expired,
])('closes the scan page for a terminal QR code error (%s)', async (key) => {
  const invalid = { key };
  mockParse.mockRejectedValueOnce(invalid);

  await expect(parseFrame()).rejects.toBe(invalid);
  expect(mockResetScanModalRoute).toHaveBeenCalledTimes(1);
  expect(isRetryableQrParseFailure(invalid)).toBe(false);
});

it.each([true, false])(
  'only shows the expired invoice toast for the active scanner (%s)',
  async (active) => {
    const controller = new AbortController();
    let rejectParse: (error: unknown) => void = () => {};
    mockParse.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectParse = reject;
      }),
    );
    const parsing = parseQRCodeWithDeps(
      'lightning:invoice',
      { popNavigation: true, autoExecuteParsedAction: false },
      { ...deps, canApplyScanResult: () => !controller.signal.aborted },
    );
    if (!active) controller.abort();
    const error = new InvoiceExpiredError({ autoToast: false });
    // Split-runtime bridges return an error payload without its prototype.
    rejectParse({ key: error.key, autoToast: error.autoToast });

    if (active) {
      await expect(parsing).rejects.toMatchObject({ key: error.key });
      expect(Toast.error).toHaveBeenCalledTimes(1);
      expect(Toast.error).toHaveBeenCalledWith({
        title: ETranslations.send_the_invoice_has_expired,
      });
      expect(mockResetScanModalRoute).toHaveBeenCalledTimes(1);
    } else {
      await expect(parsing).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
      expect(Toast.error).not.toHaveBeenCalled();
      expect(mockResetScanModalRoute).not.toHaveBeenCalled();
    }
  },
);

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

it.each([true, false])(
  'checks URL account scan ownership after the network lookup (active: %s)',
  async (active) => {
    const controller = new AbortController();
    const onResultWillClose = jest.fn();
    let finishLookup: (value: unknown) => void = () => {};
    let startLookup: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      startLookup = resolve;
    });
    mockGetNetworkSafe.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLookup = resolve;
          startLookup();
        }),
    );
    mockParse.mockResolvedValueOnce({
      type: EQRCodeHandlerType.URL_ACCOUNT,
      data: { address: 'scanned account', networkId: 'evm--1' },
    });
    jest.mocked(navigateFromOverlayToTab).mockImplementationOnce(async () => {
      if (active) expect(onResultWillClose).toHaveBeenCalledTimes(1);
    });
    const parsing = parseQRCodeWithDeps(
      'account link',
      { popNavigation: true, autoExecuteParsedAction: true },
      {
        ...deps,
        onResultWillClose,
        canApplyScanResult: () => !controller.signal.aborted,
      },
    );

    await started;
    const closeMarksWhileWaiting = onResultWillClose.mock.calls.length;
    if (!active) controller.abort();
    finishLookup({ code: 'eth' });
    if (active) {
      await expect(parsing).resolves.toMatchObject({
        type: EQRCodeHandlerType.URL_ACCOUNT,
      });
      expect(navigateFromOverlayToTab).toHaveBeenCalledTimes(1);
    } else {
      await expect(parsing).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
      expect(onResultWillClose).not.toHaveBeenCalled();
      expect(navigateFromOverlayToTab).not.toHaveBeenCalled();
    }
    expect(closeMarksWhileWaiting).toBe(0);
  },
);

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
