/* eslint-disable import/first */
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isJest: true,
    isDesktop: false,
    isNative: true,
    isNativeBackgroundThread: true,
    isWeb: false,
  },
}));
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {},
  storageHub: {},
}));
jest.mock('../dbs/local/localDb', () => ({ __esModule: true, default: {} }));
jest.mock('../dbs/simple/simpleDb', () => ({ __esModule: true, default: {} }));
jest.mock('@onekeyhq/shared/src/utils/extUtils', () => ({
  __esModule: true,
  default: { openExpandTab: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@onekeyhq/shared/src/utils/marketTokenPreviewRoute', () => ({
  storeExtensionTokenPreview: jest.fn(),
}));

import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { storeExtensionTokenPreview } from '@onekeyhq/shared/src/utils/marketTokenPreviewRoute';

import ServiceApp from './ServiceApp';

const preview = {
  address: '0xabc',
  networkId: 'evm--1',
  name: 'ABC',
  symbol: 'ABC',
  decimals: 18,
  selectedAt: 1,
};
const params = {
  network: 'eth',
  tokenAddress: '0xabc',
  skipMarketDataFetch: true,
  disableTrade: true,
  tokenDetailPreview: preview,
};

beforeEach(() => jest.clearAllMocks());

it('stores metadata before opening a no-fetch detail and sends only its handle', async () => {
  jest.mocked(storeExtensionTokenPreview).mockResolvedValue('transfer-id');
  const service = new ServiceApp({ backgroundApi: {} });
  await service.openExtensionMarketTokenDetail(params);
  expect(storeExtensionTokenPreview).toHaveBeenCalledWith(
    { network: 'eth', tokenAddress: '0xabc', isNative: false },
    preview,
  );
  expect(extUtils.openExpandTab).toHaveBeenCalledWith({
    path: '/market/token/eth/0xabc',
    params: {
      isNative: false,
      skipMarketDataFetch: true,
      disableTrade: true,
      marketTokenPreviewId: 'transfer-id',
    },
  });
});

it('uses the same native identity in storage and the URL when the flag is omitted', async () => {
  jest.mocked(storeExtensionTokenPreview).mockResolvedValue('native-transfer');
  const service = new ServiceApp({ backgroundApi: {} });
  await service.openExtensionMarketTokenDetail({
    ...params,
    tokenAddress: '',
    tokenDetailPreview: { ...preview, address: '', isNative: true },
  });
  expect(storeExtensionTokenPreview).toHaveBeenCalledWith(
    { network: 'eth', tokenAddress: '', isNative: true },
    expect.any(Object),
  );
  expect(extUtils.openExpandTab).toHaveBeenCalledWith({
    path: '/market/token/eth/',
    params: expect.objectContaining({
      isNative: true,
      marketTokenPreviewId: 'native-transfer',
    }),
  });
});

it('opens an ordinary detail without a preview when storage is unavailable', async () => {
  jest.mocked(storeExtensionTokenPreview).mockResolvedValue(undefined);
  const service = new ServiceApp({ backgroundApi: {} });
  await service.openExtensionMarketTokenDetail({
    ...params,
    skipMarketDataFetch: false,
  });
  expect(extUtils.openExpandTab).toHaveBeenCalledWith({
    path: '/market/token/eth/0xabc',
    params: { isNative: false, disableTrade: true },
  });
});

it('rejects an explicitly non-native empty address before writing a handoff', async () => {
  const service = new ServiceApp({ backgroundApi: {} });
  await expect(
    service.openExtensionMarketTokenDetail({
      ...params,
      tokenAddress: '',
      isNative: false,
    }),
  ).rejects.toThrow('Invalid market token identity');
  expect(storeExtensionTokenPreview).not.toHaveBeenCalled();
  expect(extUtils.openExpandTab).not.toHaveBeenCalled();
});

it('encodes identity segments without changing the stored identity', async () => {
  jest.mocked(storeExtensionTokenPreview).mockResolvedValue('encoded-transfer');
  const service = new ServiceApp({ backgroundApi: {} });
  await service.openExtensionMarketTokenDetail({
    ...params,
    tokenAddress: 'asset/with?separator#',
  });
  expect(storeExtensionTokenPreview).toHaveBeenCalledWith(
    { network: 'eth', tokenAddress: 'asset/with?separator#', isNative: false },
    preview,
  );
  expect(extUtils.openExpandTab).toHaveBeenCalledWith({
    path: '/market/token/eth/asset%2Fwith%3Fseparator%23',
    params: expect.any(Object),
  });
});

it('does not open an empty no-fetch detail if its transfer cannot be stored', async () => {
  jest.mocked(storeExtensionTokenPreview).mockResolvedValue(undefined);
  const service = new ServiceApp({ backgroundApi: {} });
  await expect(service.openExtensionMarketTokenDetail(params)).rejects.toThrow(
    'Unable to transfer market token preview',
  );
  expect(extUtils.openExpandTab).not.toHaveBeenCalled();
});
