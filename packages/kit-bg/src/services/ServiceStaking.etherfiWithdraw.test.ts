import {
  ECheckAmountActionType,
  type IEarnWithdrawType,
} from '@onekeyhq/shared/types/staking';

import evmSettings from '../vaults/impls/evm/settings';

import ServiceStaking from './ServiceStaking';

import type { AxiosInstance } from 'axios';

const accountId = 'account-id';
const accountAddress = '0x1111111111111111111111111111111111111111';
const protocolVault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const outputTokenAddress = '0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee';
const requestParams = {
  networkId: 'evm--1',
  provider: 'etherfi',
  // 入口仍是 eETH，赎回数量则以 liquidETH 份额为单位，不能据 symbol 改写资产。
  symbol: 'eETH',
  amount: '1.000000000000000001',
  inputTokenAddress: protocolVault,
  outputTokenAddress,
  withdrawType: 'queued' as IEarnWithdrawType,
};
const expectedRequest = {
  ...requestParams,
  accountAddress,
  vault: protocolVault,
};
const txResponse = {
  tx: {
    from: accountAddress,
    to: '0x0d2df071207e18ca8638b4f04e98c53155ec2ce0',
    data: '0x1234',
    value: '0x0',
  },
  orderId: 'withdraw-order-id',
};

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: jest.fn(async () => ({
      getAccount: async () => ({ address: accountAddress }),
    })),
  },
}));

/**
 * 保留真实协议配置查找，仅替换账户与 HTTP；返回请求桩以核对各阶段的金额口径。
 * 不访问 RPC 或发送交易，服务端响应由每个测试按需覆盖。
 */
function createServiceHarness() {
  const service = new ServiceStaking({
    backgroundApi: {
      serviceNetwork: {
        getVaultSettings: jest.fn().mockResolvedValue(evmSettings),
      },
    },
  });
  const get = jest
    .fn<
      Promise<{ data: { data: { feeFiatValue: string } } }>,
      [string, { params: Record<string, unknown> }]
    >()
    .mockResolvedValue({ data: { data: { feeFiatValue: '0.25' } } });
  const rawGet = jest
    .fn<
      Promise<{ data: { code: number; message: string } }>,
      [string, { params: Record<string, unknown> }]
    >()
    .mockResolvedValue({ data: { code: 0, message: '' } });
  const post = jest
    .fn<
      Promise<{ data: { data: typeof txResponse } }>,
      [string, Record<string, unknown>]
    >()
    .mockResolvedValue({ data: { data: txResponse } });
  jest
    .spyOn(service, 'getClient')
    .mockResolvedValue({ get, post } as unknown as AxiosInstance);
  jest
    .spyOn(service, 'getRawDataClient')
    .mockResolvedValue({ get: rawGet } as unknown as AxiosInstance);
  return { service, get, rawGet, post };
}

describe('ServiceStaking 份额赎回参数', () => {
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

  it('校验 eETH 入口时保留 liquidETH 输入、weETH 输出和完整份额精度', async () => {
    const { service, rawGet } = createServiceHarness();

    await expect(
      service.checkAmount({
        ...requestParams,
        accountId,
        protocolVault,
        action: ECheckAmountActionType.UNSTAKING,
        withdrawAll: false,
      }),
    ).resolves.toEqual({ code: 0, message: '' });

    expect(rawGet).toHaveBeenCalledWith('/earn/v1/check-amount', {
      params: expect.objectContaining({
        ...expectedRequest,
        action: ECheckAmountActionType.UNSTAKING,
        withdrawAll: false,
      }),
    });
  });

  it('确认预览透传份额口径且不修改调用方的金额参数', async () => {
    const { service, get } = createServiceHarness();
    const params = Object.freeze({
      ...requestParams,
      amount: '1.00000000000000000100',
      accountAddress,
      vault: protocolVault,
      action: ECheckAmountActionType.UNSTAKING,
    });

    await service.getTransactionConfirmation(params);

    expect(get).toHaveBeenCalledWith('/earn/v1/transaction-confirmation', {
      params: {
        ...expectedRequest,
        action: ECheckAmountActionType.UNSTAKING,
      },
    });
    expect(params.amount).toBe('1.00000000000000000100');
  });

  it.each([{ action: 'unstake' as const }, { action: 'approve' as const }])(
    '估算 $action 时保留份额与正确交易阶段',
    async (stage) => {
      const { service, get } = createServiceHarness();

      await expect(
        service.estimateFee({
          ...requestParams,
          ...stage,
          accountAddress,
          protocolVault,
          withdrawAll: false,
        }),
      ).resolves.toMatchObject({ feeFiatValue: '0.25' });

      expect(get).toHaveBeenCalledWith('/earn/v1/estimate-fee', {
        params: expect.objectContaining({
          ...expectedRequest,
          ...stage,
          withdrawAll: false,
        }),
      });
      expect(get.mock.calls[0][1].params).not.toHaveProperty('protocolVault');
      expect(get.mock.calls[0][1].params).not.toHaveProperty('prepareStep');
    },
  );

  it('最终 unstake POST 与预览使用同一入口、资产、份额单位和数量', async () => {
    const { service, post } = createServiceHarness();

    await expect(
      service.buildUnstakeTransaction({
        ...requestParams,
        accountId,
        protocolVault,
        withdrawAll: false,
      }),
    ).resolves.toEqual(txResponse);

    expect(post).toHaveBeenCalledWith(
      '/earn/v2/unstake',
      expect.objectContaining({
        ...expectedRequest,
        withdrawAll: false,
      }),
    );
    expect(post.mock.calls[0][1]).not.toHaveProperty('protocolVault');
  });

  it('取消预览与最终交易只用 identity 透传同一个链上请求', async () => {
    const { service, rawGet, get, post } = createServiceHarness();
    const identity = `0x${'ab'.repeat(32)}`;
    const cancelParams = {
      ...requestParams,
      identity,
      withdrawType: 'cancel' as const,
    };

    await service.checkAmount({
      ...cancelParams,
      accountId,
      protocolVault,
      action: ECheckAmountActionType.UNSTAKING,
      withdrawAll: false,
    });
    await service.getTransactionConfirmation({
      ...cancelParams,
      accountAddress,
      vault: protocolVault,
      action: ECheckAmountActionType.UNSTAKING,
    });
    await service.estimateFee({
      ...cancelParams,
      accountAddress,
      protocolVault,
      action: 'unstake',
    });
    await service.buildUnstakeTransaction({
      ...cancelParams,
      accountId,
      protocolVault,
    });

    const expectedCancel = {
      ...expectedRequest,
      identity,
      withdrawType: 'cancel',
    };
    expect(rawGet).toHaveBeenCalledWith('/earn/v1/check-amount', {
      params: expect.objectContaining(expectedCancel),
    });
    expect(get).toHaveBeenNthCalledWith(
      1,
      '/earn/v1/transaction-confirmation',
      {
        params: expect.objectContaining(expectedCancel),
      },
    );
    expect(get).toHaveBeenNthCalledWith(2, '/earn/v1/estimate-fee', {
      params: expect.objectContaining(expectedCancel),
    });
    expect(post).toHaveBeenCalledWith(
      '/earn/v2/unstake',
      expect.objectContaining(expectedCancel),
    );
  });

  it('所有赎回接口都不发送已删除的金额单位和独立请求 ID', async () => {
    const { service, rawGet, get, post } = createServiceHarness();

    await service.checkAmount({
      ...requestParams,
      accountId,
      protocolVault,
      action: ECheckAmountActionType.UNSTAKING,
      withdrawAll: false,
    });
    await service.getTransactionConfirmation({
      ...requestParams,
      accountAddress,
      vault: protocolVault,
      action: ECheckAmountActionType.UNSTAKING,
    });
    await service.estimateFee({
      ...requestParams,
      accountAddress,
      protocolVault,
      action: 'unstake',
    });
    await service.buildUnstakeTransaction({
      ...requestParams,
      accountId,
      protocolVault,
    });

    expect(rawGet.mock.calls[0][1].params).not.toHaveProperty('requestId');
    expect(get.mock.calls[0][1].params).not.toHaveProperty('requestId');
    expect(get.mock.calls[1][1].params).not.toHaveProperty('requestId');
    expect(post.mock.calls[0][1]).not.toHaveProperty('requestId');
    expect(rawGet.mock.calls[0][1].params).not.toHaveProperty('amountUnit');
    expect(get.mock.calls[0][1].params).not.toHaveProperty('amountUnit');
    expect(get.mock.calls[1][1].params).not.toHaveProperty('amountUnit');
    expect(post.mock.calls[0][1]).not.toHaveProperty('amountUnit');
  });
});
