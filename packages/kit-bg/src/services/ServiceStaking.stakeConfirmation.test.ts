import {
  ECheckAmountActionType,
  type IEarnStakeType,
} from '@onekeyhq/shared/types/staking';

import ServiceStaking from './ServiceStaking';

import type { AxiosInstance } from 'axios';

describe('ServiceStaking stake confirmation', () => {
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

  it('preserves a successful empty confirmation for legacy protocols', async () => {
    const service = new ServiceStaking({ backgroundApi: {} });
    const get = jest.fn().mockResolvedValue({ data: { data: undefined } });
    jest
      .spyOn(service, 'getClient')
      .mockResolvedValue({ get } as unknown as AxiosInstance);

    await expect(
      service.getTransactionConfirmation({
        networkId: 'evm--1',
        provider: 'native',
        symbol: 'ETH',
        accountAddress: '0x1111111111111111111111111111111111111111',
        action: ECheckAmountActionType.STAKING,
        amount: '0.01',
      }),
    ).resolves.toBeUndefined();
  });

  it.each(['native', 'etherfi', 'pendle'])(
    'sends standalone %s approval without converting it into a deposit',
    async (provider) => {
      const service = new ServiceStaking({ backgroundApi: {} });
      const get = jest.fn().mockResolvedValue({ data: { data: {} } });
      jest
        .spyOn(service, 'getClient')
        .mockResolvedValue({ get } as unknown as AxiosInstance);

      await expect(
        service.getTransactionConfirmation({
          networkId: 'evm--1',
          provider,
          symbol: 'WETH',
          accountAddress: '0x1111111111111111111111111111111111111111',
          action: 'approve',
          stakeType: 'normal',
          amount: '0.01',
        }),
      ).resolves.toEqual({});
      expect(get).toHaveBeenCalledWith('/earn/v1/transaction-confirmation', {
        params: expect.objectContaining({
          action: 'approve',
          stakeType: 'normal',
          amount: '0.01',
        }),
      });
    },
  );

  it.each(
    ['native', 'etherfi'].flatMap((provider) =>
      (['wrap', 'normal', undefined] as (IEarnStakeType | undefined)[]).map(
        (stakeType) => ({ provider, stakeType }),
      ),
    ),
  )('preserves $provider $stakeType confirmation context', async (context) => {
    const service = new ServiceStaking({ backgroundApi: {} });
    const confirmation =
      context.stakeType === 'wrap'
        ? {
            receive: {
              title: { text: 'Expected to receive' },
              description: { text: '0.01 WETH' },
            },
          }
        : {
            title: { text: 'Est. annual rewards' },
            rewards: [{ title: { text: '0.0003 ETH' } }],
          };
    const get = jest.fn().mockResolvedValue({
      data: { data: confirmation },
    });
    jest
      .spyOn(service, 'getClient')
      .mockResolvedValue({ get } as unknown as AxiosInstance);
    const params = Object.freeze({
      ...context,
      networkId: 'evm--1',
      symbol: 'ETH',
      accountAddress: '0x1111111111111111111111111111111111111111',
      action: ECheckAmountActionType.STAKING,
      amount: '0.0100',
    });

    await expect(service.getTransactionConfirmation(params)).resolves.toEqual(
      confirmation,
    );
    expect(get).toHaveBeenCalledWith('/earn/v1/transaction-confirmation', {
      params: { ...params, amount: '0.01' },
    });
    expect(params.amount).toBe('0.0100');
  });
});
