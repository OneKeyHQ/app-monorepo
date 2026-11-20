import axios from 'axios';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

describe('recovering an Earn swap broadcast', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('promotes only a persisted accepted fact for the stored UUID and account', async () => {
    const funding = {
      status: 'unknown' as const,
      swapTxUuid: 'swap-uuid',
      swapRecovery: {
        sender: { accountId: 'account', networkId: 'evm--1', address: '0xabc' },
      },
    };
    const getFunding = jest.fn(async () => funding);
    const recoverSwapFunding = jest.fn(async () => ({
      applied: true,
      funding: { status: 'submitted', txId: 'tx' },
    }));
    const resolveBroadcastAcceptanceFactByUuid = jest
      .fn()
      .mockResolvedValueOnce({ status: 'unknown' })
      .mockResolvedValueOnce({
        status: 'accepted',
        uuid: 'swap-uuid',
        accountId: 'account',
        networkId: 'evm--1',
        txid: 'tx',
      });
    const service = new ServiceStaking({
      backgroundApi: {
        serviceSend: { resolveBroadcastAcceptanceFactByUuid },
        serviceAccount: {
          getAccountAddressForApi: jest.fn(async () => '0xabc'),
        },
      },
    });
    Reflect.set(service, 'earnFunding', { getFunding, recoverSwapFunding });
    await expect(service.recoverEarnSwapFunding('scope')).resolves.toEqual(
      funding,
    );
    expect(recoverSwapFunding).not.toHaveBeenCalled();
    await service.recoverEarnSwapFunding('scope');
    expect(resolveBroadcastAcceptanceFactByUuid).toHaveBeenCalledWith({
      uuid: 'swap-uuid',
      accountId: 'account',
      networkId: 'evm--1',
      expectedAccountAddress: '0xabc',
    });
    expect(recoverSwapFunding).toHaveBeenCalledWith(
      'scope',
      'swap-uuid',
      'tx',
      undefined,
    );
  });

  it('announces persisted funding changes across Web tabs without an open Earn view', async () => {
    const previous = globalThis.BroadcastChannel;
    const platform = jest.replaceProperty(platformEnv, 'isWeb', true);
    const post = jest.fn();
    const close = jest.fn();
    class Channel {
      postMessage = post;
      close = close;
    }
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      value: Channel,
    });
    try {
      const service = new ServiceStaking({ backgroundApi: {} });
      Reflect.set(service, 'earnFunding', {
        changeFunding: jest.fn(async () => ({ applied: true, funding: null })),
      });
      await service.changeEarnFunding('scope', {
        type: 'claim',
        attemptId: 'attempt',
      });
      expect(post).toHaveBeenCalledWith('changed');
      expect(close).toHaveBeenCalled();
    } finally {
      platform.restore();
      Object.defineProperty(globalThis, 'BroadcastChannel', {
        configurable: true,
        value: previous,
      });
    }
  });
});
