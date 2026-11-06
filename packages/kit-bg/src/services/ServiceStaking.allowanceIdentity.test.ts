import axios from 'axios';

import ServiceStaking from './ServiceStaking';

const expected = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';

describe('ServiceStaking allowance account identity', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('rejects a changed address before sending the allowance request', async () => {
    const client = axios.create();
    const get = jest.spyOn(client, 'get');
    const service = new ServiceStaking({
      backgroundApi: {
        serviceAccount: { getAccountAddressForApi: async () => other },
      },
    });
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    await expect(
      service.fetchTokenAllowance({
        networkId: 'evm--1',
        accountId: 'account',
        tokenAddress: 'token',
        spenderAddress: 'spender',
        expectedAccountAddress: expected,
      }),
    ).rejects.toThrow('Allowance account changed');
    expect(get).not.toHaveBeenCalled();
  });

  it('queries the resolved address and does not send the expected-address guard to the API', async () => {
    const client = axios.create();
    const get = jest
      .spyOn(client, 'get')
      .mockResolvedValue({ data: { data: { allowanceParsed: '1' } } });
    const service = new ServiceStaking({
      backgroundApi: {
        serviceAccount: { getAccountAddressForApi: async () => expected },
      },
    });
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    await expect(
      service.fetchTokenAllowance({
        networkId: 'evm--1',
        accountId: 'account',
        tokenAddress: 'token',
        spenderAddress: 'spender',
        expectedAccountAddress: expected.toUpperCase(),
      }),
    ).resolves.toEqual({ allowanceParsed: '1' });
    expect(get).toHaveBeenCalledWith('/earn/v1/on-chain/allowance', {
      params: {
        accountAddress: expected,
        networkId: 'evm--1',
        tokenAddress: 'token',
        spenderAddress: 'spender',
      },
    });
  });
});
