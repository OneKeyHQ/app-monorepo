/* eslint-disable import/first */

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: jest.fn(async () => ({
      getAccount: async () => ({
        address: '0x1111111111111111111111111111111111111111',
      }),
    })),
  },
}));

import axios from 'axios';
import { utils } from 'ethers';

import {
  EtherFiLiquidReferContract,
  EthereumEBTC,
  EthereumUSDC,
  EthereumWBTC,
  EthereumWETH,
  EthereumWeETH,
} from '@onekeyhq/shared/src/consts/addresses';
import { createMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';
import { ECheckAmountActionType } from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityEarnOrders } from '../dbs/simple/entity/SimpleDbEntityEarnOrders';

import ServiceStaking from './ServiceStaking';

const account = '0x1111111111111111111111111111111111111111';
const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const queue = '0x0d2df071207e18ca8638b4f04e98c53155ec2ce0';
const teller = '0x9aa79c84b79816ab920bbce20f8f74557b514734';
const deposit = new utils.Interface([
  'function deposit(address teller,address depositAsset,uint256 depositAmount,uint256 minimumMint,address referrer)',
]);
const withdraw = new utils.Interface([
  'function requestOnChainWithdraw(address assetOut,uint128 amountOfShares,uint16 discount,uint24 secondsToDeadline)',
  'function cancelOnChainWithdraw((uint96 nonce,address user,address assetOut,uint128 amountOfShares,uint128 amountOfAssets,uint40 creationTime,uint24 secondsToMaturity,uint24 secondsToDeadline) request)',
]);

function createService() {
  const client = axios.create();
  const post = jest.spyOn(client, 'post');
  const get = jest.spyOn(client, 'get');
  const flow = { enabled: true, stakingWithApprove: true };
  const proxyRPCCall = jest.fn();
  const getBroadcastAcceptanceFactByUuid = jest.fn();
  const addOrderIfAbsent = jest.fn();
  const getOrderByTxId = jest.fn();
  const updateEtherFiSyncStatus = jest.fn().mockResolvedValue(true);
  const updateOrderStatusByTxId = jest.fn();
  const claimEtherFiOrderRetry = jest.fn().mockResolvedValue(true);
  const backgroundApi = {
    serviceDApp: { proxyRPCCall },
    serviceSend: { getBroadcastAcceptanceFactByUuid },
    simpleDb: {
      earnOrders: {
        addOrderIfAbsent,
        getOrderByTxId,
        updateEtherFiSyncStatus,
        updateOrderStatusByTxId,
        claimEtherFiOrderRetry,
      },
    },
    serviceAccount: {
      getAccountAddressForApi: jest.fn(async () => account),
    },
    serviceNetwork: {
      getVaultSettings: jest.fn(async () => ({
        stakingConfig: {
          'evm--1': {
            providers: {
              EtherFi: {
                supportedSymbols: ['WETH', 'USDC', 'WBTC'],
                configs: { WETH: flow, USDC: flow, WBTC: flow },
              },
              Native: { supportedSymbols: ['WETH'], configs: { WETH: flow } },
            },
          },
        },
      })),
    },
    serviceReferralCode: {
      checkAndUpdateReferralCode: jest.fn(async () => undefined),
    },
  };
  const service = new ServiceStaking({ backgroundApi });
  const getClient = jest.spyOn(service, 'getClient').mockResolvedValue(client);
  return {
    service,
    backgroundApi,
    post,
    get,
    proxyRPCCall,
    getBroadcastAcceptanceFactByUuid,
    addOrderIfAbsent,
    getOrderByTxId,
    updateEtherFiSyncStatus,
    updateOrderStatusByTxId,
    claimEtherFiOrderRetry,
    getClient,
    getAccountAddressForApi:
      backgroundApi.serviceAccount.getAccountAddressForApi,
  };
}

describe('EtherFi transaction amount transport', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('records a late accepted EtherFi order once and does not retry an unknown remote result', async () => {
    const {
      service,
      post,
      addOrderIfAbsent,
      getBroadcastAcceptanceFactByUuid,
    } = createService();
    const txId = `0x${'a'.repeat(64)}`;
    const identity = {
      uuid: 'attempt-1',
      accountId: 'account-1',
      networkId: 'evm--1',
    };
    const order = {
      orderId: 'order-1',
      networkId: identity.networkId,
      txId,
      status: EDecodedTxStatus.Pending,
    };
    getBroadcastAcceptanceFactByUuid.mockResolvedValue({
      status: 'accepted',
      ...identity,
      txid: txId,
    });
    addOrderIfAbsent
      .mockResolvedValueOnce('inserted')
      .mockResolvedValueOnce('existing');
    post.mockRejectedValueOnce(new Error('response lost'));
    await expect(
      service.recordLateEtherFiOrder({ ...identity, order }),
    ).resolves.toBe('remoteUnknown');
    await expect(
      service.recordLateEtherFiOrder({ ...identity, order }),
    ).resolves.toBe('remoteUnknown');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not write an order when broadcast acceptance or identity is not proven', async () => {
    const {
      service,
      post,
      addOrderIfAbsent,
      getBroadcastAcceptanceFactByUuid,
    } = createService();
    const identity = {
      uuid: 'attempt-1',
      accountId: 'account-1',
      networkId: 'evm--1',
    };
    const order = {
      orderId: 'order-1',
      networkId: identity.networkId,
      txId: `0x${'b'.repeat(64)}`,
      status: EDecodedTxStatus.Pending,
    };
    getBroadcastAcceptanceFactByUuid.mockResolvedValue({ status: 'unknown' });
    await expect(
      service.recordLateEtherFiOrder({ ...identity, order }),
    ).resolves.toBe('unknown');
    getBroadcastAcceptanceFactByUuid.mockResolvedValue({
      status: 'accepted',
      ...identity,
      txid: `0x${'c'.repeat(64)}`,
    });
    await expect(
      service.recordLateEtherFiOrder({ ...identity, order }),
    ).resolves.toBe('unknown');
    expect(addOrderIfAbsent).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('shares one remote attempt between normal success and a late callback', async () => {
    const {
      service,
      post,
      addOrderIfAbsent,
      getBroadcastAcceptanceFactByUuid,
    } = createService();
    const identity = {
      uuid: 'attempt-1',
      accountId: 'account-1',
      networkId: 'evm--1',
    };
    const order = {
      orderId: 'order-1',
      networkId: identity.networkId,
      txId: `0x${'e'.repeat(64)}`,
      status: EDecodedTxStatus.Pending,
    };
    getBroadcastAcceptanceFactByUuid.mockResolvedValue({
      status: 'accepted',
      ...identity,
      txid: order.txId,
    });
    addOrderIfAbsent.mockResolvedValue('inserted');
    let release: () => void = () => undefined;
    let notifyStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    post.mockImplementationOnce(async () => {
      notifyStarted();
      await gate;
      return Promise.reject(new Error('response lost'));
    });
    const normal = service.addEarnOrder(order, {
      etherFiOnce: true,
      accountId: 'account-1',
    });
    await started;
    const late = service.recordLateEtherFiOrder({ ...identity, order });
    await Promise.resolve();
    release();
    await expect(normal).resolves.toBe('remoteUnknown');
    await expect(late).resolves.toBe('remoteUnknown');
    expect(addOrderIfAbsent).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not reuse an old transaction sync result for a replacement', async () => {
    const { service, backgroundApi, post, getBroadcastAcceptanceFactByUuid } =
      createService();
    const orders = new SimpleDbEntityEarnOrders();
    Reflect.set(orders, 'appStorage', createMemoryStorage(null));
    Reflect.set(backgroundApi.simpleDb, 'earnOrders', orders);
    const identity = {
      uuid: 'attempt-1',
      accountId: 'account-1',
      networkId: 'evm--1',
    };
    const order = {
      orderId: 'order-1',
      networkId: identity.networkId,
      txId: `0x${'3'.repeat(64)}`,
      status: EDecodedTxStatus.Pending,
    };
    post.mockResolvedValueOnce({ data: { code: 0 } });
    await expect(
      service.addEarnOrder(order, {
        etherFiOnce: true,
        accountId: 'account-1',
      }),
    ).resolves.toBe('synced');
    const replacement = `0x${'4'.repeat(64)}`;
    await orders.updateOrderStatusByTxId({
      currentTxId: order.txId,
      newTxId: replacement,
      status: EDecodedTxStatus.Pending,
    });
    getBroadcastAcceptanceFactByUuid.mockResolvedValue({
      status: 'accepted',
      ...identity,
      txid: replacement,
    });
    await expect(
      service.recordLateEtherFiOrder({
        ...identity,
        order: { ...order, txId: replacement },
      }),
    ).resolves.toBe('remoteUnknown');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('keeps a retryable server response as an unknown synchronization outcome', async () => {
    const {
      service,
      post,
      addOrderIfAbsent,
      getBroadcastAcceptanceFactByUuid,
      updateEtherFiSyncStatus,
    } = createService();
    const identity = {
      uuid: 'attempt-1',
      accountId: 'account-1',
      networkId: 'evm--1',
    };
    const order = {
      orderId: 'order-1',
      networkId: identity.networkId,
      txId: `0x${'f'.repeat(64)}`,
      status: EDecodedTxStatus.Pending,
    };
    getBroadcastAcceptanceFactByUuid.mockResolvedValue({
      status: 'accepted',
      ...identity,
      txid: order.txId,
    });
    addOrderIfAbsent.mockResolvedValue('inserted');
    post.mockResolvedValueOnce({
      data: { code: 0, data: { retryable: true } },
    });
    await expect(
      service.recordLateEtherFiOrder({ ...identity, order }),
    ).resolves.toBe('remoteUnknown');
    expect(updateEtherFiSyncStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'unknown' }),
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('permits a later retry only when obtaining the client failed before any request', async () => {
    const {
      service,
      post,
      getClient,
      addOrderIfAbsent,
      getOrderByTxId,
      claimEtherFiOrderRetry,
    } = createService();
    const order = {
      orderId: 'order-1',
      networkId: 'evm--1',
      txId: `0x${'2'.repeat(64)}`,
      status: EDecodedTxStatus.Pending,
    };
    getClient.mockRejectedValueOnce(new Error('client unavailable'));
    addOrderIfAbsent
      .mockResolvedValueOnce('inserted')
      .mockResolvedValueOnce('existing');
    getOrderByTxId.mockResolvedValue({
      ...order,
      etherFiSyncStatus: 'notSent',
    });
    claimEtherFiOrderRetry.mockResolvedValue(true);
    post.mockResolvedValueOnce({ data: { code: 0 } });
    await expect(
      service.addEarnOrder(order, {
        etherFiOnce: true,
        accountId: 'account-1',
      }),
    ).resolves.toBe('notSent');
    expect(post).not.toHaveBeenCalled();
    expect(claimEtherFiOrderRetry).not.toHaveBeenCalled();
    await expect(
      service.addEarnOrder(order, {
        etherFiOnce: true,
        accountId: 'account-1',
      }),
    ).resolves.toBe('synced');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('retries a known-unsent confirmed order only when its account opens EtherFi history', async () => {
    const { service, backgroundApi, post, get, getClient } = createService();
    const orders = new SimpleDbEntityEarnOrders();
    Reflect.set(orders, 'appStorage', createMemoryStorage(null));
    Reflect.set(backgroundApi.simpleDb, 'earnOrders', orders);
    const order = {
      orderId: 'order-offline',
      networkId: 'evm--1',
      txId: `0x${'7'.repeat(64)}`,
      status: EDecodedTxStatus.Pending,
    };
    getClient.mockRejectedValueOnce(new Error('client unavailable'));
    await expect(
      service.addEarnOrder(order, {
        etherFiOnce: true,
        accountId: 'account-1',
      }),
    ).resolves.toBe('notSent');
    getClient.mockRejectedValueOnce(new Error('client unavailable'));
    await service.updateEarnOrder({
      txs: [
        {
          accountId: 'account-1',
          networkId: order.networkId,
          txId: order.txId,
          status: EDecodedTxStatus.Confirmed,
        },
      ],
    });
    expect(await orders.getOrderByTxId(order.txId)).toMatchObject({
      status: EDecodedTxStatus.Confirmed,
      etherFiSyncStatus: 'notSent',
    });
    get.mockResolvedValue({ data: { data: { list: [] } } });
    post.mockResolvedValue({ data: { code: 0 } });
    const history = {
      networkId: order.networkId,
      provider: 'EtherFi',
      symbol: 'ETH',
    };
    await service.getStakeHistory({ ...history, accountId: 'account-2' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(post).not.toHaveBeenCalled();
    await service.getStakeHistory({ ...history, accountId: 'account-1' });
    for (let i = 0; i < 10 && !post.mock.calls.length; i += 1)
      await new Promise((resolve) => setImmediate(resolve));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each([
    { syncStatus: 'pending', expectedPosts: 0 },
    { syncStatus: 'unknown', expectedPosts: 0 },
    { syncStatus: 'notSent', expectedPosts: 1 },
    { syncStatus: 'synced', expectedPosts: 1 },
    { syncStatus: undefined, expectedPosts: 1 },
  ] as const)(
    'updates local transaction status without resending an unresolved order: $syncStatus',
    async ({ syncStatus, expectedPosts }) => {
      const {
        service,
        post,
        getOrderByTxId,
        updateOrderStatusByTxId,
        addOrderIfAbsent,
      } = createService();
      const txId = `0x${'1'.repeat(64)}`;
      getOrderByTxId.mockResolvedValue({
        orderId: 'order-1',
        networkId: 'evm--1',
        txId,
        status: EDecodedTxStatus.Pending,
        etherFiSyncStatus: syncStatus,
        etherFiAccountId: 'account-1',
      });
      addOrderIfAbsent.mockResolvedValue('existing');
      post.mockResolvedValue({ data: { code: 0 } });
      await service.updateEarnOrder({
        txs: [
          {
            accountId: 'account-1',
            networkId: 'evm--1',
            txId,
            status: EDecodedTxStatus.Confirmed,
          },
        ],
      });
      expect(post).toHaveBeenCalledTimes(expectedPosts);
      expect(updateOrderStatusByTxId).toHaveBeenCalledWith({
        currentTxId: txId,
        status: EDecodedTxStatus.Confirmed,
      });
    },
  );

  it('does not update or retry an EtherFi order from a different account history', async () => {
    const { service, post, getOrderByTxId, updateOrderStatusByTxId } =
      createService();
    const txId = `0x${'8'.repeat(64)}`;
    getOrderByTxId.mockResolvedValue({
      orderId: 'order-1',
      networkId: 'evm--1',
      txId,
      status: EDecodedTxStatus.Pending,
      etherFiSyncStatus: 'notSent',
      etherFiAccountId: 'account-1',
    });
    await service.updateEarnOrder({
      txs: [
        {
          accountId: 'account-2',
          networkId: 'evm--1',
          txId,
          status: EDecodedTxStatus.Confirmed,
        },
      ],
    });
    expect(post).not.toHaveBeenCalled();
    expect(updateOrderStatusByTxId).not.toHaveBeenCalled();
  });

  it.each(['unavailable', 'conflict', 'localFailed'] as const)(
    'does not send a remote order update when local registration is %s',
    async (outcome) => {
      const {
        service,
        post,
        addOrderIfAbsent,
        getBroadcastAcceptanceFactByUuid,
      } = createService();
      const identity = {
        uuid: 'attempt-1',
        accountId: 'account-1',
        networkId: 'evm--1',
      };
      const txId = `0x${'d'.repeat(64)}`;
      getBroadcastAcceptanceFactByUuid.mockResolvedValue({
        status: 'accepted',
        ...identity,
        txid: txId,
      });
      if (outcome === 'localFailed') {
        addOrderIfAbsent.mockRejectedValue(new Error('storage error'));
      } else {
        addOrderIfAbsent.mockResolvedValue(outcome);
      }
      await expect(
        service.recordLateEtherFiOrder({
          ...identity,
          order: {
            orderId: 'order-1',
            networkId: identity.networkId,
            txId,
            status: EDecodedTxStatus.Pending,
          },
        }),
      ).resolves.toBe(outcome);
      expect(post).not.toHaveBeenCalled();
    },
  );

  it('checks recovery through the selected account and both RPC responses', async () => {
    const { service, proxyRPCCall } = createService();
    const txid = `0x${'a'.repeat(64)}`;
    const blockHash = `0x${'b'.repeat(64)}`;
    proxyRPCCall.mockImplementation(
      async ({ request }: { request: { method: string } }) => [
        Promise.resolve(
          request.method === 'eth_getTransactionByHash'
            ? {
                hash: txid,
                blockHash,
                from: account,
                to: EthereumWETH,
                input: '0xd0e30db0',
                value: '0x16345785d8a0000',
                chainId: '0x1',
              }
            : { transactionHash: txid, blockHash, status: '0x1' },
        ),
      ],
    );
    await expect(
      service.checkEtherFiNativeDepositTx({
        accountId: 'account-1',
        accountAddress: account,
        networkId: 'evm--1',
        vault,
        amount: '0.1',
        phase: 'wrap',
        txid,
      }),
    ).resolves.toBe('success');
    expect(proxyRPCCall).toHaveBeenCalledTimes(2);
    await expect(
      service.checkEtherFiNativeDepositTx({
        accountId: 'account-1',
        accountAddress: vault,
        networkId: 'evm--1',
        vault,
        amount: '0.1',
        phase: 'wrap',
        txid,
      }),
    ).rejects.toThrow();
    expect(proxyRPCCall).toHaveBeenCalledTimes(2);
  });

  it('does not return a recovery result if the account changes during RPC', async () => {
    const { service, proxyRPCCall, getAccountAddressForApi } = createService();
    const txid = `0x${'a'.repeat(64)}`;
    getAccountAddressForApi
      .mockResolvedValueOnce(account)
      .mockResolvedValueOnce(vault);
    proxyRPCCall.mockResolvedValue([null]);
    await expect(
      service.checkEtherFiNativeDepositTx({
        accountId: 'account-1',
        accountAddress: account,
        networkId: 'evm--1',
        vault,
        amount: '0.1',
        phase: 'wrap',
        txid,
      }),
    ).rejects.toThrow('EtherFi recovery account changed');
  });

  it('does not treat an empty RPC envelope as a definitive result', async () => {
    const { service, proxyRPCCall } = createService();
    proxyRPCCall.mockResolvedValue([]);
    await expect(
      service.checkEtherFiNativeDepositTx({
        accountId: 'account-1',
        accountAddress: account,
        networkId: 'evm--1',
        vault,
        amount: '0.1',
        phase: 'wrap',
        txid: `0x${'a'.repeat(64)}`,
      }),
    ).rejects.toThrow('RPC response unavailable');
  });

  it('sends an exact normalized amount for a deposit', async () => {
    const { service, post } = createService();
    post.mockResolvedValue({
      data: {
        data: {
          tx: {
            from: account,
            to: EtherFiLiquidReferContract,
            value: '0x0',
            data: deposit.encodeFunctionData('deposit', [
              teller,
              EthereumWETH,
              1,
              1,
              account,
            ]),
          },
        },
      },
    });
    await service.buildStakeTransaction({
      accountId: 'account-1',
      networkId: 'evm--1',
      provider: 'etherfi',
      symbol: 'WETH',
      protocolVault: vault,
      amount: '.000000000000000001',
      inputTokenAddress: EthereumWETH,
      stakeType: 'normal',
    });
    expect(post).toHaveBeenCalledWith(
      '/earn/v2/stake',
      expect.objectContaining({ amount: '0.000000000000000001' }),
    );
  });

  it('sends the selected share amount for a queued withdrawal', async () => {
    const { service, post } = createService();
    post.mockResolvedValue({
      data: {
        data: {
          tx: {
            from: account,
            to: queue,
            value: '0x0',
            data: withdraw.encodeFunctionData('requestOnChainWithdraw', [
              EthereumWeETH,
              utils.parseUnits('0.5', 18),
              0,
              1_209_600,
            ]),
          },
        },
      },
    });
    await service.buildUnstakeTransaction({
      accountId: 'account-1',
      networkId: 'evm--1',
      provider: 'etherfi',
      symbol: 'WETH',
      protocolVault: vault,
      amount: '.5',
      outputTokenAddress: EthereumWeETH,
      withdrawType: 'queued',
    });
    expect(post).toHaveBeenCalledWith(
      '/earn/v2/unstake',
      expect.objectContaining({ amount: '0.5' }),
    );
  });

  it.each([
    {
      symbol: 'USDC',
      vault: '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c',
      teller: '0x4de413a26fc24c3fc27cc983be70aa9c5c299387',
      queue: '0x38fc1ba73b7ed289955a07d9f11a85b6e388064a',
      input: EthereumUSDC,
      output: EthereumUSDC,
      amount: '.000001',
      normalized: '0.000001',
    },
    {
      symbol: 'WBTC',
      vault: '0x5f46d540b6ed704c3c8789105f30e075aa900726',
      teller: '0x8ea0b382d054dbebeb1d0ae47ee4ac433c730353',
      queue: '0x77a2fd42f8769d8063f2e75061fc200014e41edf',
      input: EthereumWBTC,
      output: EthereumEBTC,
      amount: '.00000001',
      normalized: '0.00000001',
    },
  ])(
    'preserves one atomic unit for $symbol deposits and withdrawals',
    async (asset) => {
      const { service, post } = createService();
      post.mockResolvedValueOnce({
        data: {
          data: {
            tx: {
              from: account,
              to: EtherFiLiquidReferContract,
              value: '0x0',
              data: deposit.encodeFunctionData('deposit', [
                asset.teller,
                asset.input,
                1,
                1,
                account,
              ]),
            },
          },
        },
      });
      post.mockResolvedValueOnce({
        data: {
          data: {
            tx: {
              from: account,
              to: asset.queue,
              value: '0x0',
              data: withdraw.encodeFunctionData('requestOnChainWithdraw', [
                asset.output,
                1,
                0,
                1_209_600,
              ]),
            },
          },
        },
      });
      const base = {
        accountId: 'account-1',
        networkId: 'evm--1',
        provider: 'etherfi',
        symbol: asset.symbol,
        protocolVault: asset.vault,
        amount: asset.amount,
      };
      await service.buildStakeTransaction({
        ...base,
        inputTokenAddress: asset.input,
        stakeType: 'normal',
      });
      await service.buildUnstakeTransaction({
        ...base,
        outputTokenAddress: asset.output,
        withdrawType: 'queued',
      });
      expect(post).toHaveBeenNthCalledWith(
        1,
        '/earn/v2/stake',
        expect.objectContaining({ amount: asset.normalized }),
      );
      expect(post).toHaveBeenNthCalledWith(
        2,
        '/earn/v2/unstake',
        expect.objectContaining({ amount: asset.normalized }),
      );
    },
  );

  it('does not change the amount sent for another provider', async () => {
    const { service, post } = createService();
    post.mockResolvedValue({
      data: { data: { tx: null, orderId: 'order-1' } },
    });
    await service.buildStakeTransaction({
      accountId: 'account-1',
      networkId: 'evm--1',
      provider: 'native',
      symbol: 'WETH',
      amount: '.5',
    });
    expect(post).toHaveBeenCalledWith(
      '/earn/v2/stake',
      expect.objectContaining({ amount: '.5' }),
    );
  });

  it('keeps a cancellation amount at zero and binds the request identity', async () => {
    const { service, post } = createService();
    const request = [1, account, EthereumWeETH, 1, 1, 1, 1, 1];
    const tupleType =
      'tuple(uint96 nonce,address user,address assetOut,uint128 amountOfShares,uint128 amountOfAssets,uint40 creationTime,uint24 secondsToMaturity,uint24 secondsToDeadline)';
    const identity = utils.keccak256(
      utils.defaultAbiCoder.encode([tupleType], [request]),
    );
    post.mockResolvedValue({
      data: {
        data: {
          tx: {
            from: account,
            to: queue,
            value: '0x0',
            data: withdraw.encodeFunctionData('cancelOnChainWithdraw', [
              request,
            ]),
          },
        },
      },
    });
    await service.buildUnstakeTransaction({
      accountId: 'account-1',
      networkId: 'evm--1',
      provider: 'etherfi',
      symbol: 'WETH',
      protocolVault: vault,
      amount: '0',
      identity,
      withdrawType: 'cancel',
    });
    expect(post).toHaveBeenCalledWith(
      '/earn/v2/unstake',
      expect.objectContaining({ amount: '0', identity }),
    );
  });

  it('normalizes EtherFi fee inputs and preserves other providers', async () => {
    const { service, get } = createService();
    get.mockResolvedValue({ data: { data: { feeFiatValue: '1' } } });
    const base = {
      networkId: 'evm--1',
      provider: 'etherfi',
      symbol: 'WETH',
    };
    await service.estimateFee({ ...base, action: 'approve', amount: '.5' });
    await service.estimateFee({ ...base, action: 'unstake', amount: '1.' });
    await service.estimateFee({ ...base, action: 'unstake', amount: '0' });
    await service.estimateFee({
      ...base,
      provider: 'native',
      action: 'unstake',
      amount: '.5',
    });
    for (const [index, amount] of ['0.5', '1', '0', '.5'].entries()) {
      expect(get).toHaveBeenNthCalledWith(
        index + 1,
        '/earn/v1/estimate-fee',
        expect.objectContaining({
          params: expect.objectContaining({ amount }),
        }),
      );
    }
  });

  it('does not convert an unavailable EtherFi fee into a zero fee', async () => {
    const { service, get } = createService();
    get.mockResolvedValue({ data: { data: {} } });
    const params = {
      networkId: 'evm--1',
      provider: 'etherfi',
      symbol: 'WETH',
      action: 'unstake' as const,
      amount: '1',
    };
    await expect(service.estimateFee(params)).rejects.toThrow(
      'EtherFi fee estimate unavailable',
    );
    await expect(
      service.estimateFee({ ...params, provider: 'native' }),
    ).resolves.toMatchObject({ feeFiatValue: '0' });
    get.mockResolvedValue({ data: { data: { feeFiatValue: '0' } } });
    await expect(service.estimateFee(params)).resolves.toMatchObject({
      feeFiatValue: '0',
    });
  });

  it('rejects a withdrawal amount check when the account address changed', async () => {
    const { service } = createService();
    await expect(
      service.checkAmount({
        accountId: 'account-1',
        networkId: 'evm--1',
        provider: 'etherfi',
        symbol: 'WETH',
        action: ECheckAmountActionType.UNSTAKING,
        amount: '1',
        withdrawAll: false,
        expectedAccountAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).rejects.toThrow('Amount check account changed');
  });

  it.each(['NaN', '-1', 'Infinity'])(
    'rejects invalid allowance %s for the expected account',
    async (allowanceParsed) => {
      const { service, get } = createService();
      get.mockResolvedValue({
        data: { data: { allowance: '0', allowanceParsed } },
      });
      await expect(
        service.fetchTokenAllowance({
          accountId: 'account-1',
          networkId: 'evm--1',
          tokenAddress: vault,
          spenderAddress: queue,
          expectedAccountAddress: account,
        }),
      ).rejects.toThrow('Invalid allowance response');
    },
  );
});
