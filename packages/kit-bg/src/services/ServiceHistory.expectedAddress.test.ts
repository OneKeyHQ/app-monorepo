/* eslint-disable import/first */
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
const mockGetVault = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: (...args: unknown[]) => mockGetVault(...args) },
}));
const ServiceHistory = require('./ServiceHistory')
  .default as typeof import('./ServiceHistory').default;

function setup(address: string) {
  const getAddress = jest.fn(async () => address);
  const fetchDetail = jest.fn(async (_params: unknown) => ({
    data: { data: { data: { status: 1 }, tokens: {}, nfts: {} } },
  }));
  mockGetVault.mockResolvedValue({ fetchAccountHistoryDetail: fetchDetail });
  const service = Object.assign(
    Object.create(ServiceHistory.prototype) as InstanceType<
      typeof ServiceHistory
    >,
    {
      buildFetchHistoryListParams: async () => ({}),
      backgroundApi: {
        serviceAccount: {
          getAccountAddressForApi: getAddress,
          getAccountXpub: async () => undefined,
        },
      },
    },
  );
  return { service, getAddress, fetchDetail };
}

beforeEach(() => jest.resetAllMocks());

it('does not query a different address despite the original address being restored later', async () => {
  const { service, getAddress, fetchDetail } = setup('0xbbb');
  const request = service.fetchTxDetails({
    accountId: 'account',
    networkId: 'evm--1',
    txid: 'tx',
    expectedAccountAddress: '0xaaa',
  });
  getAddress.mockResolvedValue('0xaaa');
  expect(await request).toBeNull();
  expect(fetchDetail).not.toHaveBeenCalled();
});

it('compares EVM addresses case-insensitively and does not transmit the expectation', async () => {
  const { service, fetchDetail } = setup('0xAaA');
  await service.fetchTxDetails({
    accountId: 'account',
    networkId: 'evm--1',
    txid: 'tx',
    expectedAccountAddress: '0xaaa',
  });
  expect(fetchDetail).toHaveBeenCalledWith(
    expect.objectContaining({ accountAddress: '0xAaA' }),
  );
  expect(fetchDetail.mock.calls[0][0]).not.toHaveProperty(
    'expectedAccountAddress',
  );
});

it('keeps legacy calls without an expected address compatible', async () => {
  const { service, fetchDetail } = setup('0xbbb');
  await service.fetchTxDetails({
    accountId: 'account',
    networkId: 'evm--1',
    txid: 'tx',
  });
  expect(fetchDetail).toHaveBeenCalledTimes(1);
});

it('uses exact non-EVM address comparison and refuses an unresolved identity', async () => {
  const { service, fetchDetail, getAddress } = setup('AddressA');
  await service.fetchTxDetails({
    accountId: 'account',
    networkId: 'sol--101',
    txid: 'tx',
    expectedAccountAddress: 'addressa',
  });
  expect(fetchDetail).not.toHaveBeenCalled();
  getAddress.mockRejectedValueOnce(new OneKeyLocalError('unavailable'));
  await service.fetchHistoryTxDetails({
    accountId: 'account',
    networkId: 'sol--101',
    txid: 'tx',
    accountAddress: 'AddressA',
    expectedAccountAddress: 'AddressA',
  });
  expect(fetchDetail).not.toHaveBeenCalled();
});
