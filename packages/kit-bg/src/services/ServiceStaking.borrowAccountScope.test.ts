import axios from 'axios';

import ServiceStaking from './ServiceStaking';

const request = {
  accountId: 'external--wc--session--0',
  networkId: 'evm--1',
  provider: 'aave',
  marketAddress: '0xmarket',
};

describe('account-scoped borrow reads', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['reserves', 'health'] as const)(
    'rejects a changed address before the %s request',
    async (kind) => {
      const client = axios.create();
      const get = jest
        .spyOn(client, 'get')
        .mockResolvedValue({ data: { data: {} } });
      const getAccountAddressForApi = jest.fn(async () => '0xOther');
      const service = new ServiceStaking({
        backgroundApi: { serviceAccount: { getAccountAddressForApi } },
      });
      jest.spyOn(service, 'getClient').mockResolvedValue(client);
      const params = { ...request, expectedAccountAddress: '0xOwner' };
      await expect(
        kind === 'reserves'
          ? service.getBorrowReserves(params)
          : service.getBorrowHealthFactor(params),
      ).rejects.toThrow('Borrow account changed');
      expect(get).not.toHaveBeenCalled();
    },
  );

  it.each(['reserves', 'health'] as const)(
    'sends only the verified address to the %s endpoint',
    async (kind) => {
      const client = axios.create();
      const get = jest
        .spyOn(client, 'get')
        .mockResolvedValue({ data: { data: {} } });
      const getAccountAddressForApi = jest.fn(async () => '0xOwner');
      const service = new ServiceStaking({
        backgroundApi: { serviceAccount: { getAccountAddressForApi } },
      });
      jest.spyOn(service, 'getClient').mockResolvedValue(client);
      const params = { ...request, expectedAccountAddress: '0xowner' };
      if (kind === 'reserves') await service.getBorrowReserves(params);
      else await service.getBorrowHealthFactor(params);
      expect(get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({ accountAddress: '0xOwner' }),
        }),
      );
      expect(get).toHaveBeenCalledWith(expect.any(String), {
        params: expect.not.objectContaining({
          expectedAccountAddress: expect.anything(),
        }),
      });
      expect(get).toHaveBeenCalledWith(expect.any(String), {
        params: expect.not.objectContaining({ accountId: expect.anything() }),
      });
    },
  );

  it.each(['reserves', 'health'] as const)(
    'treats case-sensitive Solana addresses as different for %s',
    async (kind) => {
      const client = axios.create();
      const get = jest
        .spyOn(client, 'get')
        .mockResolvedValue({ data: { data: {} } });
      const getAccountAddressForApi = jest.fn(async () => 'addressA');
      const service = new ServiceStaking({
        backgroundApi: { serviceAccount: { getAccountAddressForApi } },
      });
      jest.spyOn(service, 'getClient').mockResolvedValue(client);
      const params = {
        ...request,
        networkId: 'sol--101',
        expectedAccountAddress: 'AddressA',
      };
      await expect(
        kind === 'reserves'
          ? service.getBorrowReserves(params)
          : service.getBorrowHealthFactor(params),
      ).rejects.toThrow('Borrow account changed');
      expect(get).not.toHaveBeenCalled();
    },
  );
});
