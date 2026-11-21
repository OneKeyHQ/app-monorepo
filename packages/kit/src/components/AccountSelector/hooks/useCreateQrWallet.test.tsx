/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import type { IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';
import { OneKeyErrorScanQrCodeCancel } from '@onekeyhq/shared/src/errors';

import { useCreateQrWallet } from './useCreateQrWallet';

const urJson = { type: 'bytes', cbor: 'mock' };
const accounts = { qrDevice: undefined, airGapAccounts: [] };
const mockPrepare = jest.fn<Promise<IAirGapUrJson>, [unknown]>();
const mockCancel = jest.fn(async (_params: { owner: string }) => undefined);
const mockBuild = jest.fn<Promise<typeof accounts>, [unknown]>();
const mockCreate = jest.fn();
const mockGetRequestState = jest.fn(() => 'active');
let mockSignal: AbortSignal | undefined;

jest.mock('react-intl', () => ({ useIntl: () => ({}) }));
jest.mock('@onekeyhq/components', () => ({}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: { intl: { formatMessage: jest.fn() }, onLocaleChange: jest.fn() },
}));
jest.mock('../../../hooks/useAppNavigation', () => () => ({}));
jest.mock(
  '../../../views/ScanQrCode/hooks/useScanQrCodeLazy',
  () => () => ({}),
);
jest.mock('../../../states/jotai/contexts/accountSelector/actionsLazy', () => ({
  useAccountSelectorLazyAction: () => mockCreate,
}));
jest.mock('../../../views/ScanQrCode/utils/getAccountIdOnNetwork', () => ({
  getAddressCreationRequestState: () => mockGetRequestState(),
  getAddressCreationRequestSignal: () => mockSignal,
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getWallet: async () => ({ id: 'qr-1' }) },
    serviceQrWallet: {
      prepareQrcodeWalletAddressCreate: (params: unknown) =>
        mockPrepare(params),
      cancelQrWalletAddressCreate: (params: { owner: string }) =>
        mockCancel(params),
      buildAirGapMultiAccounts: (params: unknown) => mockBuild(params),
    },
  },
}));

const params = {
  walletId: 'qr-1',
  networkId: 'btc--0',
  indexedAccountId: 'qr-1--0',
  addressCreationRequest: { id: 'scan-1', nodeId: 'main' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRequestState.mockReturnValue('active');
  mockPrepare.mockResolvedValue(urJson);
  mockBuild.mockResolvedValue(accounts);
  mockSignal = undefined;
});

it('cancels the matching stage request and drops a late device response', async () => {
  const controller = new AbortController();
  mockSignal = controller.signal;
  let finishPrepare: (value: IAirGapUrJson) => void = () => {};
  mockPrepare.mockReturnValueOnce(
    new Promise((resolve) => {
      finishPrepare = resolve;
    }),
  );
  const { result } = renderHook(() => useCreateQrWallet());

  const exchange = result.current.createQrWalletAccount(params);
  await waitFor(() => expect(mockPrepare).toHaveBeenCalledTimes(1));
  controller.abort();
  expect(mockCancel).toHaveBeenCalledWith({ owner: 'scan-1' });
  finishPrepare(urJson);

  await expect(exchange).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
  expect(mockBuild).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
});

it('stops importing if the scanner is cancelled while building accounts', async () => {
  const controller = new AbortController();
  mockSignal = controller.signal;
  let finishBuild: (value: typeof accounts) => void = () => {};
  mockBuild.mockReturnValueOnce(
    new Promise((resolve) => {
      finishBuild = resolve;
    }),
  );
  const { result } = renderHook(() => useCreateQrWallet());

  const exchange = result.current.createQrWalletAccount(params);
  await waitFor(() => expect(mockBuild).toHaveBeenCalledTimes(1));
  controller.abort();
  finishBuild(accounts);

  await expect(exchange).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
  expect(mockCancel).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
});

it('lets the linked legacy child finish before React Navigation refocuses its scanner', async () => {
  mockSignal = new AbortController().signal;
  mockPrepare.mockImplementationOnce(async () => {
    mockGetRequestState.mockReturnValue('inactive');
    return urJson;
  });
  const { result } = renderHook(() => useCreateQrWallet());

  await result.current.createQrWalletAccount(params);
  expect(mockCreate).toHaveBeenCalledWith(
    'createQrWallet',
    expect.objectContaining({
      assertCanCreate: expect.any(Function),
    }),
  );
});
