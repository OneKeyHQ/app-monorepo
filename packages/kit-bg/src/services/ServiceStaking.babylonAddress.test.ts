import axios from 'axios';

import { vaultFactory } from '../vaults/factory';

import ServiceStaking from './ServiceStaking';

jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));

const accountId = 'btc-account';
const networkId = 'btc--0';
const base = { accountId, networkId, symbol: 'BTC', provider: 'babylon' };
const addressA = 'bc1Original';
const addressB = 'bc1Replacement';

describe('Babylon withdrawal address binding', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  let address = addressA;
  const post = jest.fn(async () => ({ data: { data: { tx: {} } } }));
  let service: ServiceStaking;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });
  beforeEach(() => {
    address = addressA;
    post.mockClear();
    jest.mocked(vaultFactory.getVault).mockImplementation(
      async () =>
        ({
          getAccount: async () => ({ address }),
        }) as Awaited<ReturnType<typeof vaultFactory.getVault>>,
    );
    service = new ServiceStaking({ backgroundApi: {} });
    jest
      .spyOn(service, 'getClient')
      .mockResolvedValue(Object.assign(axios.create(), { post }));
    jest.spyOn(service, 'getStakingConfigs').mockResolvedValue({
      enabled: true,
      usePublicKey: false,
    } as Awaited<ReturnType<ServiceStaking['getStakingConfigs']>>);
  });
  afterEach(() => jest.restoreAllMocks());

  it('rejects when the account address changes before build or push', async () => {
    address = addressB;
    await expect(
      service.buildUnstakeTransaction({
        ...base,
        amount: '1',
        expectedAccountAddress: addressA,
      }),
    ).rejects.toThrow('Task account address changed');
    await expect(
      service.unstakePush({
        ...base,
        txId: 'request',
        unstakeTxHex: 'signed',
        expectedAccountAddress: addressA,
      }),
    ).rejects.toThrow('Task account address changed');
    expect(post).not.toHaveBeenCalled();
  });

  it.each(['', 'bc1original'])(
    'rejects missing or different-case expected address %p',
    async (expectedAccountAddress) => {
      await expect(
        service.unstakePush({
          ...base,
          txId: 'request',
          unstakeTxHex: 'signed',
          expectedAccountAddress,
        }),
      ).rejects.toThrow('Task account address changed');
      expect(post).not.toHaveBeenCalled();
    },
  );

  it('does not send the expected address field and keeps legacy requests unchanged', async () => {
    await service.buildUnstakeTransaction({
      ...base,
      amount: '1',
      expectedAccountAddress: addressA,
    });
    expect(post).toHaveBeenLastCalledWith(
      '/earn/v2/unstake',
      expect.not.objectContaining({ expectedAccountAddress: addressA }),
    );
    expect(post).toHaveBeenLastCalledWith(
      '/earn/v2/unstake',
      expect.objectContaining({ accountAddress: addressA }),
    );
    await service.unstakePush({
      ...base,
      txId: 'request',
      unstakeTxHex: 'signed',
      expectedAccountAddress: addressA,
    });
    expect(post).toHaveBeenLastCalledWith('/earn/v1/unstake/push', {
      accountAddress: addressA,
      networkId,
      symbol: 'BTC',
      provider: 'babylon',
      txId: 'request',
      unstakeTxHex: 'signed',
    });
    address = addressB;
    await service.unstakePush({
      ...base,
      txId: 'request',
      unstakeTxHex: 'signed',
    });
    expect(post).toHaveBeenLastCalledWith(
      '/earn/v1/unstake/push',
      expect.objectContaining({ accountAddress: addressB }),
    );
  });
});
