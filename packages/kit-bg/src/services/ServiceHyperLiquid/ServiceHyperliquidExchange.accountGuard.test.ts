import { atom } from 'jotai';

import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { jotaiDefaultStore } from '../../states/jotai/utils/jotaiDefaultStore';

import ServiceHyperliquid from './ServiceHyperliquid';
import ServiceHyperliquidExchange from './ServiceHyperliquidExchange';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IPerpsActiveAccountStatusInfoAtom } from '../../states/jotai/atoms';

interface IMockExchangeClient {
  userAddress: string;
  order: jest.Mock;
  modify: jest.Mock;
  updateLeverage: jest.Mock;
  updateIsolatedMargin: jest.Mock;
  userSetAbstraction: jest.Mock<
    Promise<unknown>,
    [{ user: string; abstraction: string }]
  >;
  approveAgent: jest.Mock;
  approveBuilderFee: jest.Mock;
  twapCancel: jest.Mock;
  cancel: jest.Mock;
}

const mockExchangeClients: IMockExchangeClient[] = [];
const mockAgentApprovalResponse = jest.fn<
  Promise<{ status: string; response: { type: string } }>,
  [{ agentAddress: string }]
>();
const approvalSuccess = { status: 'ok', response: { type: 'default' } };
type IStatusUpdate =
  | IPerpsActiveAccountStatusInfoAtom
  | ((
      previous: IPerpsActiveAccountStatusInfoAtom,
    ) => IPerpsActiveAccountStatusInfoAtom);
const mockStatusWrite = jest.fn<Promise<void>, [IStatusUpdate]>();
const mockActiveAccountAtom = atom<{
  accountAddress?: string;
  accountId?: string;
}>({});
const mockActiveAccountState = {
  get value() {
    return jotaiDefaultStore.get(mockActiveAccountAtom);
  },
  set value(value) {
    jotaiDefaultStore.set(mockActiveAccountAtom, value);
  },
};

jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn(),
  ExchangeClient: jest
    .fn()
    .mockImplementation(({ wallet }: { wallet: { userAddress: string } }) => {
      const client: IMockExchangeClient = {
        userAddress: wallet.userAddress,
        order: jest.fn().mockResolvedValue({
          status: 'ok',
          response: {
            type: 'order',
            data: { statuses: [{ resting: { oid: 1 } }] },
          },
        }),
        cancel: jest.fn().mockResolvedValue({
          status: 'ok',
          response: { type: 'cancel', data: { statuses: ['success'] } },
        }),
        twapCancel: jest.fn().mockResolvedValue({
          status: 'ok',
          response: { type: 'twapCancel', data: { status: 'success' } },
        }),
        updateLeverage: jest
          .fn()
          .mockResolvedValue({ status: 'ok', response: { type: 'default' } }),
        updateIsolatedMargin: jest
          .fn()
          .mockResolvedValue({ status: 'ok', response: { type: 'default' } }),
        userSetAbstraction: jest.fn().mockResolvedValue({ status: 'ok' }),
        approveAgent: jest.fn((params: { agentAddress: string }) =>
          mockAgentApprovalResponse(params),
        ),
        approveBuilderFee: jest
          .fn()
          .mockResolvedValue({ status: 'ok', response: { type: 'default' } }),
        modify: jest.fn().mockResolvedValue({
          status: 'ok',
          response: { type: 'default' },
        }),
      };
      mockExchangeClients.push(client);
      return client;
    }),
}));
jest.mock('p-timeout', () => ({
  __esModule: true,
  default: (promise: Promise<unknown>) => promise,
}));
jest.mock('./hyperLiquidApiClients', () => ({
  hyperLiquidApiClients: {
    infoClient: { userRole: async () => ({ role: 'user' }) },
  },
}));
jest.mock('../../states/jotai/atoms', () => ({
  perpsActiveAccountAtom: {
    get: () => Promise.resolve(mockActiveAccountState.value),
    atom: () => mockActiveAccountAtom,
  },
  perpsActiveAccountStatusAtom: {
    get: () => Promise.resolve({ canTrade: true, details: { agentOk: true } }),
  },
  perpsAccountLoadingInfoAtom: { set: jest.fn() },
  perpsActiveAccountStatusInfoAtom: {
    set: (update: IStatusUpdate) => mockStatusWrite(update),
  },
  perpsAbstractionModeAtom: { get: () => Promise.resolve(undefined) },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    getLocale: () => 'en-US',
    onLocaleChange: () => () => {},
  },
}));
const mockExchangeLog = jest.fn<void, [string, unknown]>();
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    perp: {
      agentLifeCycle: { trackReason: jest.fn() },
      hyperliquid: new Proxy(
        {},
        {
          get: (_target, event) => (params: unknown) =>
            mockExchangeLog(String(event), params),
        },
      ),
    },
  },
}));

const ADDRESS_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ADDRESS_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const symbolMeta = { assetId: 0, isSpot: false, universe: { szDecimals: 3 } };
const tradingUniverse = { universesByDex: [[{ assetId: 0, szDecimals: 3 }]] };
const accountChangedMessage = ETranslations.active_trading_account_changed__msg;

const getSymbolMeta = jest.fn();
const getTradingUniverse = jest.fn();
const backgroundApi = {
  serviceHyperliquid: {
    getSymbolMeta,
    isAccountStatusCheckCurrent: jest.fn((seq: number) => seq === 1),
    fetchExtraAgentsWithCache: { clear: jest.fn() },
    getUserApprovedMaxBuilderFeeWithCache: { clear: jest.fn() },
  },
  serviceHyperliquidWallet: {
    getOnekeyWallet: jest.fn(
      async ({ userAccountId }: { userAccountId: string }) => ({
        userAddress: userAccountId,
        getTempSignatureAndClear: jest.fn(),
      }),
    ),
    getProxyWallet: jest.fn(
      async ({
        agentCredential,
      }: {
        agentCredential: { agentAddress: string; userAddress: string };
      }) => ({
        address: agentCredential.agentAddress,
        wallet: { userAddress: agentCredential.userAddress },
      }),
    ),
  },
  serviceRookieGuide: { recordTaskCompleted: jest.fn() },
  simpleDb: {
    perp: {
      getPerpData: jest.fn().mockResolvedValue({}),
      getReferralBannerCache: jest
        .fn()
        .mockResolvedValue({ reason: 'already_has_referrer' }),
      getTradingUniverse,
      getSpotMeta: jest.fn().mockResolvedValue({ universes: [], tokens: [] }),
      isFirstPerpOrderOpen: jest.fn().mockResolvedValue(false),
      markPerpOrderOpen: jest.fn(),
    },
  },
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const credentialFor = (userAddress: string) => ({
  agentAddress: `0x${userAddress.slice(-4).repeat(10)}`,
  agentName: EHyperLiquidAgentName.OneKeyAgent1,
  userAddress,
  validUntil: 2_000_000_000_000,
});

const addPositionParams = {
  coin: 'BTC',
  expectedAccountAddress: ADDRESS_A,
  isBuy: true,
  size: '0.1',
  price: '100',
  orderType: 'limit' as const,
  tif: 'Gtc' as const,
};

const chaseParams = {
  coin: 'BTC',
  oid: 7,
  newPrice: '101',
  isBuy: true,
  size: '0.1',
  reduceOnly: false,
  amendKind: { kind: 'limit' as const, tif: 'Gtc' as const },
  alwaysPlace: true as const,
  expectedAccountAddress: ADDRESS_A,
};

describe('ServiceHyperliquidExchange account guard', () => {
  let service: ServiceHyperliquidExchange;
  const previousScope = globalThis.$onekeyIsInBackground;

  const switchTo = async (address: string) => {
    mockActiveAccountState.value = { accountAddress: address };
    await service.setup({
      userAddress: address as `0x${string}`,
      agentCredential: credentialFor(address),
    });
  };

  const orderCalls = () =>
    mockExchangeClients.reduce(
      (sum, client) => sum + client.order.mock.calls.length,
      0,
    );
  const modifyCalls = () =>
    mockExchangeClients.reduce(
      (sum, client) => sum + client.modify.mock.calls.length,
      0,
    );

  beforeEach(async () => {
    globalThis.$onekeyIsInBackground = true;
    jest.clearAllMocks();
    mockAgentApprovalResponse.mockReset().mockResolvedValue(approvalSuccess);
    mockExchangeClients.length = 0;
    getSymbolMeta.mockResolvedValue(symbolMeta);
    getTradingUniverse.mockResolvedValue(tradingUniverse);
    service = new ServiceHyperliquidExchange({
      backgroundApi: backgroundApi as unknown as IBackgroundApi,
    });
    await switchTo(ADDRESS_A);
  });

  afterEach(() => {
    globalThis.$onekeyIsInBackground = previousScope;
  });

  it.each([
    ['pro', true, '100'],
    ['pro', false, '103'],
    ['simple', true, '102'],
    ['simple', false, '101'],
  ] as const)(
    'sends the reviewed %s Chase price as ALO (isBuy=%s, price=%s)',
    async (tradingUiMode, isBuy, newPrice) => {
      await service.amendOrderPriceByOid({
        coin: 'BTC',
        oid: 7,
        newPrice,
        isBuy,
        size: '0.1',
        reduceOnly: false,
        amendKind: { kind: 'limit', tif: 'Alo' },
        expectedAccountAddress: ADDRESS_A,
        tradingUiMode,
      });

      expect(mockExchangeClients[0].modify).toHaveBeenCalledWith({
        oid: 7,
        order: expect.objectContaining({
          b: isBuy,
          p: newPrice,
          t: { limit: { tif: 'Alo' } },
        }),
      });
    },
  );

  describe.each(['simple', 'pro', undefined] as const)(
    'analytics mode %s',
    (tradingUiMode) => {
      it.each([
        ['orderOpen', false],
        ['orderOpen', true],
        ['ordersClose', false],
        ['ordersClose', true],
        ['setPositionTpsl', false],
        ['setPositionTpsl', true],
        ['modifyOrder', false],
        ['modifyOrder', true],
        ['cancelOrder', false],
        ['cancelOrder', true],
        ['updateLeverage', false],
        ['updateLeverage', true],
        ['updateIsolatedMargin', false],
        ['updateIsolatedMargin', true],
      ] as const)(
        'logs %s with failure=%s without sending metadata to the SDK',
        async (event, fail) => {
          const client = mockExchangeClients[0];
          const options = { tradingUiMode };
          const sdkMethod = {
            orderOpen: client.order,
            ordersClose: client.order,
            setPositionTpsl: client.order,
            modifyOrder: client.modify,
            cancelOrder: client.cancel,
            updateLeverage: client.updateLeverage,
            updateIsolatedMargin: client.updateIsolatedMargin,
          }[event];
          if (fail)
            sdkMethod.mockRejectedValueOnce(new Error('exchange unavailable'));
          const calls = {
            orderOpen: () =>
              service.orderOpen({
                assetId: 0,
                isBuy: true,
                size: '0.1',
                price: '100',
                type: 'limit',
                tradingUiMode,
              }),
            ordersClose: () =>
              service.ordersClose(
                [{ assetId: 0, isBuy: true, size: '0.1', midPx: '100' }],
                options,
              ),
            setPositionTpsl: () =>
              service.setPositionTpsl({
                assetId: 0,
                expectedAccountAddress: ADDRESS_A,
                positionSize: '0.1',
                isBuy: true,
                tpTriggerPx: '120',
                tradingUiMode,
              }),
            modifyOrder: () =>
              service.amendOrderPriceByOid({ ...chaseParams, tradingUiMode }),
            cancelOrder: () =>
              service.cancelOrder([{ assetId: 0, oid: 7 }], options),
            updateLeverage: () =>
              service.updateLeverage(
                { asset: 0, leverage: 5, isCross: true },
                options,
              ),
            updateIsolatedMargin: () =>
              service.updateIsolatedMargin(
                { asset: 0, isBuy: true, ntli: 100 },
                options,
              ),
          };
          if (fail) await expect(calls[event]()).rejects.toThrow();
          else await calls[event]();
          expect(mockExchangeLog).toHaveBeenCalledWith(
            event,
            expect.objectContaining({
              tradingUiMode: tradingUiMode ?? 'pro',
              status: fail ? 'fail' : 'success',
            }),
          );
          expect(sdkMethod).toHaveBeenCalledTimes(1);
          expect(JSON.stringify(sdkMethod.mock.calls)).not.toContain(
            'tradingUiMode',
          );
        },
      );
    },
  );

  it('preserves the localized price error when setting position TP/SL', async () => {
    await expect(
      service.setPositionTpsl({
        assetId: 0,
        expectedAccountAddress: ADDRESS_A,
        positionSize: '0',
        isBuy: true,
        slTriggerPx: '0',
      }),
    ).rejects.toMatchObject({
      message: ETranslations.perp_order_price_too_small__msg,
    });
    expect(orderCalls()).toBe(0);
  });

  it('rejects a confirmed order after the selected account changes', async () => {
    await switchTo(ADDRESS_B);
    await expect(
      service.orderOpen({
        assetId: 0,
        isBuy: true,
        size: '0.1',
        price: '100',
        type: 'limit',
        expectedAccountAddress: ADDRESS_A,
      }),
    ).rejects.toThrow(accountChangedMessage);
    expect(orderCalls()).toBe(0);
  });

  it('updates leverage for the expected account', async () => {
    await service.updateLeverage(
      { asset: 0, leverage: 5, isCross: true },
      { expectedAccountAddress: ADDRESS_A },
    );
    expect(mockExchangeClients[0].updateLeverage).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale leverage dialog after an account switch', async () => {
    await switchTo(ADDRESS_B);
    await expect(
      service.updateLeverage(
        { asset: 0, leverage: 5, isCross: true },
        { expectedAccountAddress: ADDRESS_A },
      ),
    ).rejects.toThrow(accountChangedMessage);
    for (const client of mockExchangeClients)
      expect(client.updateLeverage).not.toHaveBeenCalled();
  });

  it('rejects leverage changes if the account switches during log preparation', async () => {
    jest
      .spyOn(
        service as unknown as { _buildLogContext: () => Promise<object> },
        '_buildLogContext',
      )
      .mockImplementationOnce(async () => {
        await switchTo(ADDRESS_B);
        return {};
      });
    await expect(
      service.updateLeverage(
        { asset: 0, leverage: 5, isCross: true },
        { expectedAccountAddress: ADDRESS_A },
      ),
    ).rejects.toThrow(accountChangedMessage);
    for (const client of mockExchangeClients)
      expect(client.updateLeverage).not.toHaveBeenCalled();
  });

  describe.each(['approveBuilderFee', 'approveAgent', 'removeAgent'] as const)(
    '%s enable-trading signer',
    (operation) => {
      const guard = { expectedAccountAddress: ADDRESS_A, checkSeq: 1 };
      const run = () => {
        const agentName = EHyperLiquidAgentName.OneKeyAgent1;
        if (operation === 'removeAgent')
          return service.removeAgent({ agentName }, guard);
        if (operation === 'approveAgent')
          return service.approveAgent(
            { agent: ADDRESS_B, agentName, authorize: true },
            guard,
          );
        return service.approveBuilderFee(
          { builder: ADDRESS_B, maxFeeRate: '0.01%' },
          guard,
        );
      };
      const setupMaster = async (
        address: typeof ADDRESS_A | typeof ADDRESS_B,
      ) => {
        mockActiveAccountState.value = {
          accountAddress: address,
          accountId: address,
        };
        await service.setup({ userAddress: address, userAccountId: address });
      };
      beforeEach(async () => {
        backgroundApi.serviceHyperliquid.isAccountStatusCheckCurrent.mockImplementation(
          (seq) => seq === 1,
        );
        await setupMaster(ADDRESS_A);
      });

      it('uses the current master signer once', async () => {
        await run();
        const [agentClient, masterClient] = mockExchangeClients;
        const method =
          operation === 'approveBuilderFee'
            ? 'approveBuilderFee'
            : 'approveAgent';
        expect(masterClient[method]).toHaveBeenCalledTimes(1);
        expect(agentClient[method]).not.toHaveBeenCalled();
      });

      it.each([
        'A to B',
        'A to B to A',
        'new check for A',
        'changed active account',
      ] as const)('rejects %s while preparing a signature', async (change) => {
        const reached = createDeferred<void>();
        const resume = createDeferred<void>();
        jest
          .spyOn(
            service as unknown as { _buildLogContext: () => Promise<object> },
            '_buildLogContext',
          )
          .mockImplementationOnce(async () => {
            reached.resolve();
            await resume.promise;
            return { accountAddress: ADDRESS_A };
          });
        const result = run();
        await reached.promise;
        if (change === 'changed active account') {
          mockActiveAccountState.value = {
            accountAddress: ADDRESS_B,
            accountId: ADDRESS_B,
          };
        } else {
          backgroundApi.serviceHyperliquid.isAccountStatusCheckCurrent.mockReturnValue(
            false,
          );
          if (change !== 'new check for A') await setupMaster(ADDRESS_B);
          if (change === 'A to B to A') await setupMaster(ADDRESS_A);
        }
        resume.resolve();
        await expect(result).rejects.toThrow(accountChangedMessage);
        for (const client of mockExchangeClients) {
          expect(client.approveAgent).not.toHaveBeenCalled();
          expect(client.approveBuilderFee).not.toHaveBeenCalled();
        }
      });
    },
  );

  it('reads the completed approval signature from its original wallet after a switch', async () => {
    const takeA = jest.fn();
    const takeB = jest.fn();
    const wallet = backgroundApi.serviceHyperliquidWallet;
    wallet.getOnekeyWallet
      .mockResolvedValueOnce({
        userAddress: ADDRESS_A,
        getTempSignatureAndClear: takeA,
      })
      .mockResolvedValueOnce({
        userAddress: ADDRESS_B,
        getTempSignatureAndClear: takeB,
      });
    await service.setup({ userAddress: ADDRESS_A, userAccountId: ADDRESS_A });
    const reached = createDeferred<void>();
    const response = createDeferred<typeof approvalSuccess>();
    mockAgentApprovalResponse.mockImplementationOnce(async () => {
      reached.resolve();
      return response.promise;
    });
    const approval = service.approveAgent({
      agent: ADDRESS_B,
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      authorize: true,
    });
    await reached.promise;
    mockActiveAccountState.value = {
      accountAddress: ADDRESS_B,
      accountId: ADDRESS_B,
    };
    await service.setup({ userAddress: ADDRESS_B, userAccountId: ADDRESS_B });
    response.resolve(approvalSuccess);
    await approval;
    expect(takeA).toHaveBeenCalledTimes(1);
    expect(takeB).not.toHaveBeenCalled();
  });

  it.each([
    'builder fee lookup',
    'slot removal',
    'approval retry',
    'signed response',
    'credential write',
  ] as const)('handles a new account check during %s', async (stage) => {
    const reached = createDeferred<void>();
    const resume = createDeferred<void>();
    const pause = async () => {
      reached.resolve();
      await resume.promise;
    };
    const saveFor = jest.fn<void, [string]>();
    let approvedAgent: string | undefined;
    let savedAgent: string | undefined;
    const checker = Object.create(
      ServiceHyperliquid.prototype,
    ) as ServiceHyperliquid;
    const api = {
      ...backgroundApi,
      serviceHyperliquid: checker,
      serviceHyperliquidExchange: service,
      servicePassword: {
        ensureHyperLiquidAgentPasswordSessionReady: async () => {},
        encodeSensitiveText: async () => {
          if (stage === 'credential write') await pause();
          return 'encoded-fixture';
        },
      },
      serviceAccount: {
        getHyperLiquidAgentCredentialInfo: async () =>
          savedAgent
            ? {
                ...credentialFor(ADDRESS_A),
                agentAddress: savedAgent,
              }
            : undefined,
        addOrUpdateHyperLiquidAgentCredential: async (params: {
          userAddress: string;
          agentAddress: string;
        }) => {
          saveFor(params.userAddress);
          savedAgent = params.agentAddress;
          return { credentialId: 'agent' };
        },
      },
    };
    Object.assign(service, { backgroundApi: api });
    Object.assign(checker, {
      backgroundApi: api,
      perpsAccountStatusCheckSeq: 0,
      perpsAccountStatusChecksInFlight: 0,
      perpsAccountStatusCheckIdleWaiters: new Set(),
      pendingAgentApprovals: new Map(),
      fetchUserAbstraction: async () => 'unifiedAccount',
      getBuilderFeeConfig: async () =>
        stage === 'builder fee lookup'
          ? { expectBuilderAddress: ADDRESS_B, expectMaxBuilderFee: 10 }
          : {},
      getUserApprovedMaxBuilderFeeWithCache: Object.assign(
        async ({ userAddress }: { userAddress: string }) => {
          if (userAddress !== ADDRESS_A) return 10;
          await pause();
          return 0;
        },
        { clear: jest.fn() },
      ),
      fetchExtraAgentsWithCache: Object.assign(
        async ({ user }: { user: string }) => {
          if (user !== ADDRESS_A) return [];
          if (stage === 'slot removal')
            return ['external1', 'external2', 'external3'].map((name) => ({
              name,
              address: ADDRESS_B,
            }));
          return approvedAgent
            ? [
                {
                  name: EHyperLiquidAgentName.OneKeyAgent1,
                  address: approvedAgent,
                },
              ]
            : [];
        },
        { clear: jest.fn() },
      ),
    });
    if (stage === 'slot removal') {
      const remove = service.removeAgent.bind(service);
      jest
        .spyOn(service, 'removeAgent')
        .mockImplementationOnce(async (...args) => {
          await pause();
          return remove(...args);
        });
    }
    if (stage === 'approval retry') {
      mockAgentApprovalResponse.mockResolvedValueOnce({
        status: 'err',
        response: { type: 'default' },
      });
      jest.spyOn(timerUtils, 'wait').mockImplementationOnce(pause);
    } else {
      mockAgentApprovalResponse.mockImplementationOnce(
        async ({ agentAddress }) => {
          approvedAgent = agentAddress;
          if (stage === 'signed response') await pause();
          return approvalSuccess;
        },
      );
    }
    const select = (address: string) => {
      mockActiveAccountState.value = {
        accountAddress: address,
        accountId: address,
      };
    };
    select(ADDRESS_A);
    const old = checker.checkPerpsAccountStatus({
      isEnableTradingTrigger: true,
    });
    await reached.promise;
    select(ADDRESS_B);
    await checker.checkPerpsAccountStatus();
    let next: Promise<void> | undefined;
    if (stage === 'credential write') {
      select(ADDRESS_A);
      next = checker.checkPerpsAccountStatus({ isEnableTradingTrigger: true });
      await flush();
    }
    resume.resolve();
    await Promise.all([old, next]);
    const dispatched =
      stage === 'approval retry' ||
      stage === 'signed response' ||
      stage === 'credential write';
    expect(mockAgentApprovalResponse).toHaveBeenCalledTimes(dispatched ? 1 : 0);
    for (const client of mockExchangeClients) {
      expect(client.approveBuilderFee).not.toHaveBeenCalled();
      if (client.userAddress === ADDRESS_B)
        expect(client.approveAgent).not.toHaveBeenCalled();
    }
    if (stage === 'signed response' || stage === 'credential write') {
      expect(saveFor.mock.calls).toEqual([[ADDRESS_A]]);
      expect(savedAgent).toBe(approvedAgent);
    } else {
      expect(saveFor).not.toHaveBeenCalled();
    }
  });

  const margin = { asset: 0, isBuy: true, ntli: 100 };

  it.each([
    'active account',
    'signing client',
    'client during preparation',
  ] as const)('blocks isolated margin when the %s changes', async (change) => {
    if (change === 'active account') {
      mockActiveAccountState.value = { accountAddress: ADDRESS_B };
    } else if (change === 'signing client') {
      await service.setup({
        userAddress: ADDRESS_B,
        agentCredential: credentialFor(ADDRESS_B),
      });
    } else {
      jest
        .spyOn(
          service as unknown as { _buildLogContext: () => Promise<object> },
          '_buildLogContext',
        )
        .mockImplementationOnce(async () => {
          await switchTo(ADDRESS_B);
          await switchTo(ADDRESS_A);
          return {};
        });
    }
    await expect(
      service.updateIsolatedMargin(margin, {
        expectedAccountAddress: ADDRESS_A,
      }),
    ).rejects.toThrow(accountChangedMessage);
    for (const client of mockExchangeClients) {
      expect(client.updateIsolatedMargin).not.toHaveBeenCalled();
    }
  });

  it('rejects an unbound legacy margin request when the selected account has cleared', async () => {
    mockActiveAccountState.value = {};
    await expect(service.updateIsolatedMargin(margin)).rejects.toThrow(
      accountChangedMessage,
    );
    expect(mockExchangeClients[0].updateIsolatedMargin).not.toHaveBeenCalled();
  });

  it.each([
    ['only the selected account ID changes', ADDRESS_B, ADDRESS_A, false],
    ['only the selected address changes', ADDRESS_A, ADDRESS_B, false],
    [
      'only the address casing changes',
      ADDRESS_A,
      ADDRESS_A.toUpperCase(),
      true,
    ],
  ] as const)(
    'rechecks the enable-trading abstraction signer when %s before the next status check',
    async (_label, accountId, accountAddress, shouldSign) => {
      const reachedWallet = createDeferred<void>();
      const resumeWallet = createDeferred<void>();
      const userWallet = {
        userAddress: ADDRESS_A,
        getTempSignatureAndClear: jest.fn(),
      };
      backgroundApi.serviceHyperliquidWallet.getOnekeyWallet
        .mockResolvedValueOnce(userWallet)
        .mockImplementationOnce(async () => {
          reachedWallet.resolve();
          await resumeWallet.promise;
          return userWallet;
        });
      const api = { ...backgroundApi, serviceHyperliquidExchange: service };
      const checker = new ServiceHyperliquid({ backgroundApi: api });
      Object.assign(api, { serviceHyperliquid: checker });
      Object.assign(service, { backgroundApi: api });
      const invalidateMode = jest.spyOn(
        checker.fetchUserAbstractionRawWithCache,
        'delete',
      );
      const fetchUserAbstraction = jest
        .fn()
        .mockResolvedValueOnce('disabled')
        .mockResolvedValueOnce('disabled')
        .mockResolvedValueOnce('unifiedAccount');
      Object.assign(checker, {
        checkBuilderFeeStatus: jest.fn(),
        checkAgentStatus: async () => credentialFor(ADDRESS_A),
        fetchUserAbstraction,
      });
      mockActiveAccountState.value = {
        accountId: ADDRESS_A,
        accountAddress: ADDRESS_A,
      };
      const pending = checker.checkPerpsAccountStatus({
        isEnableTradingTrigger: true,
      });
      await reachedWallet.promise;
      mockActiveAccountState.value = { accountId, accountAddress };
      expect(checker.isAccountStatusCheckCurrent(1)).toBe(true);
      resumeWallet.resolve();
      const error: unknown = await pending.catch((err: unknown) => err);
      const calls = mockExchangeClients.flatMap(
        (client) => client.userSetAbstraction.mock.calls,
      );
      if (shouldSign) {
        expect(error).toBeUndefined();
        expect(calls).toEqual([
          [{ user: ADDRESS_A, abstraction: 'unifiedAccount' }],
        ]);
        expect(invalidateMode).toHaveBeenCalledWith({
          accountAddress: ADDRESS_A,
        });
        expect(fetchUserAbstraction).toHaveBeenCalledTimes(3);
        const [update] = mockStatusWrite.mock.calls[0];
        const status =
          typeof update === 'function' ? update(undefined) : update;
        expect(status?.details.abstractionOk).toBe(true);
      } else {
        expect(calls).toEqual([]);
        expect(error).toMatchObject({ message: accountChangedMessage });
        expect(invalidateMode).not.toHaveBeenCalled();
        expect(fetchUserAbstraction).toHaveBeenCalledTimes(2);
      }
    },
  );

  it('sets an explicitly requested account mode without an enable-trading check', async () => {
    mockActiveAccountState.value = {
      accountId: ADDRESS_A,
      accountAddress: ADDRESS_A,
    };
    await service.setAbstractionWithUserWallet({
      userAccountId: ADDRESS_A,
      userAddress: ADDRESS_A,
      abstraction: 'portfolioMargin',
    });
    expect(mockExchangeClients.at(-1)?.userSetAbstraction).toHaveBeenCalledWith(
      {
        user: ADDRESS_A,
        abstraction: 'portfolioMargin',
      },
    );
  });

  it.each([
    'agent check',
    'agent wallet setup',
    'user wallet setup',
    'abstraction check',
    'abstraction wallet setup',
    'status write',
  ] as const)(
    'keeps the new account signer when a previous %s resumes',
    async (stage) => {
      const reached = createDeferred<void>();
      const resume = createDeferred<void>();
      async function pause() {
        reached.resolve();
        await resume.promise;
      }
      const wallet = backgroundApi.serviceHyperliquidWallet;
      const userWallet = {
        userAddress: ADDRESS_A,
        getTempSignatureAndClear: jest.fn(),
      };
      if (stage === 'agent wallet setup') {
        wallet.getProxyWallet.mockImplementationOnce(async () => {
          await pause();
          return { address: ADDRESS_A, wallet: userWallet };
        });
      } else if (
        stage === 'user wallet setup' ||
        stage === 'abstraction wallet setup'
      ) {
        if (stage === 'abstraction wallet setup') {
          wallet.getOnekeyWallet.mockResolvedValueOnce(userWallet);
        }
        wallet.getOnekeyWallet.mockImplementationOnce(async () => {
          await pause();
          return userWallet;
        });
      }
      const written: { status?: IPerpsActiveAccountStatusInfoAtom } = {};
      if (stage === 'status write') {
        const write = (update: IStatusUpdate) => {
          written.status =
            typeof update === 'function' ? update(written.status) : update;
        };
        mockStatusWrite
          .mockImplementationOnce(async (update) => {
            await pause();
            write(update);
          })
          .mockImplementationOnce(async (update) => write(update));
      }
      let abstractionReads = 0;
      const checker = Object.create(
        ServiceHyperliquid.prototype,
      ) as ServiceHyperliquid;
      const api = {
        ...backgroundApi,
        serviceHyperliquid: checker,
        serviceHyperliquidExchange: service,
      };
      Object.assign(service, { backgroundApi: api });
      Object.assign(checker, {
        backgroundApi: api,
        perpsAccountStatusCheckSeq: 0,
        perpsAccountStatusChecksInFlight: 0,
        pendingAgentApprovals: new Map(),
        perpsAccountStatusCheckIdleWaiters: new Set(),
        checkBuilderFeeStatus: jest.fn(),
        fetchUserAbstraction: async (address: string) => {
          if (address === ADDRESS_A) {
            abstractionReads += 1;
            if (stage === 'abstraction check' && abstractionReads === 2)
              await pause();
            if (stage.startsWith('abstraction')) return 'disabled';
          }
          return 'unifiedAccount';
        },
        checkAgentStatus: async ({
          accountAddress,
        }: {
          accountAddress: string;
        }) => {
          if (accountAddress === ADDRESS_A && stage === 'agent check')
            await pause();
          return credentialFor(accountAddress);
        },
      });
      mockActiveAccountState.value = {
        accountAddress: ADDRESS_A,
        accountId: ADDRESS_A,
      };
      const oldCheck = checker.checkPerpsAccountStatus({
        isEnableTradingTrigger: true,
      });
      await reached.promise;
      mockActiveAccountState.value = {
        accountAddress: ADDRESS_B,
        accountId: ADDRESS_B,
      };
      await checker.checkPerpsAccountStatus();
      const currentClient = mockExchangeClients[mockExchangeClients.length - 1];
      expect(currentClient.userAddress).toBe(ADDRESS_B);
      const clientCount = mockExchangeClients.length;
      resume.resolve();
      await oldCheck;
      await service.updateIsolatedMargin(margin, {
        expectedAccountAddress: ADDRESS_B,
      });
      expect(currentClient.updateIsolatedMargin).toHaveBeenCalledWith(margin);
      if (stage === 'status write')
        expect(written.status?.accountAddress).toBe(ADDRESS_B);
      expect(mockExchangeClients).toHaveLength(clientCount);
      for (const client of mockExchangeClients)
        expect(client.userSetAbstraction).not.toHaveBeenCalled();
      for (const client of mockExchangeClients.filter(
        (c) => c !== currentClient,
      )) {
        expect(client.updateIsolatedMargin).not.toHaveBeenCalled();
      }
    },
  );

  it.each(['order', 'twap'] as const)(
    'rejects stale %s cancellation when background has already switched accounts',
    async (kind) => {
      await switchTo(ADDRESS_B);
      const options = { expectedAccountAddress: ADDRESS_A };
      const pending =
        kind === 'order'
          ? service.cancelOrder([{ assetId: 0, oid: 7 }], options)
          : service.cancelTwapOrder({ assetId: 0, twapId: 7 }, options);
      await expect(pending).rejects.toThrow(accountChangedMessage);
      for (const client of mockExchangeClients) {
        expect(client.cancel).not.toHaveBeenCalled();
        expect(client.twapCancel).not.toHaveBeenCalled();
      }
    },
  );

  it('cancels TWAP for the expected account', async () => {
    await service.cancelTwapOrder(
      { assetId: 0, twapId: 7 },
      { expectedAccountAddress: ADDRESS_A },
    );
    expect(mockExchangeClients[0].twapCancel).toHaveBeenCalledWith({
      a: 0,
      t: 7,
    });
  });

  it('rejects TWAP cancellation if the account switches during log preparation', async () => {
    jest
      .spyOn(
        service as unknown as { _buildLogContext: () => Promise<object> },
        '_buildLogContext',
      )
      .mockImplementationOnce(async () => {
        await switchTo(ADDRESS_B);
        return {};
      });
    await expect(
      service.cancelTwapOrder(
        { assetId: 0, twapId: 7 },
        { expectedAccountAddress: ADDRESS_A },
      ),
    ).rejects.toThrow(accountChangedMessage);
    for (const client of mockExchangeClients)
      expect(client.twapCancel).not.toHaveBeenCalled();
  });

  it('signs an add-position order with the confirmed account', async () => {
    await service.placeOrderByCoin(addPositionParams);

    expect(mockExchangeClients).toHaveLength(1);
    expect(mockExchangeClients[0].userAddress).toBe(ADDRESS_A);
    expect(mockExchangeClients[0].order).toHaveBeenCalledTimes(1);
  });

  it('rejects an add-position order when the account switches during the metadata lookup', async () => {
    const meta = createDeferred<typeof symbolMeta>();
    getSymbolMeta.mockReturnValueOnce(meta.promise);

    const pending = service.placeOrderByCoin(addPositionParams);
    await flush();
    expect(getSymbolMeta).toHaveBeenCalledTimes(1);

    await switchTo(ADDRESS_B);
    meta.resolve(symbolMeta);

    await expect(pending).rejects.toThrow(accountChangedMessage);
    expect(mockExchangeClients.map((client) => client.userAddress)).toEqual([
      ADDRESS_A,
      ADDRESS_B,
    ]);
    expect(orderCalls()).toBe(0);
  });

  it('rejects a chase amendment when the account switches during the metadata lookup', async () => {
    const meta = createDeferred<typeof symbolMeta>();
    getSymbolMeta.mockReturnValueOnce(meta.promise);

    const pending = service.amendOrderPriceByOid(chaseParams);
    await flush();
    expect(getSymbolMeta).toHaveBeenCalledTimes(1);

    await switchTo(ADDRESS_B);
    meta.resolve(symbolMeta);

    await expect(pending).rejects.toThrow(accountChangedMessage);
    expect(modifyCalls()).toBe(0);
  });

  it.each(['market', 'limit'] as const)(
    'rejects an old %s close confirmation after switching accounts',
    async (type) => {
      await switchTo(ADDRESS_B);
      await expect(
        service.ordersClose(
          [
            {
              assetId: 0,
              isBuy: true,
              size: '0.1',
              ...(type === 'market' ? { midPx: '100' } : { limitPx: '100' }),
            },
          ],
          { expectedAccountAddress: ADDRESS_A, tradingUiMode: 'simple' },
        ),
      ).rejects.toThrow(accountChangedMessage);
      expect(orderCalls()).toBe(0);
    },
  );

  it('rejects a close when the account switches during precision lookup', async () => {
    const universe = createDeferred<typeof tradingUniverse>();
    getTradingUniverse.mockReturnValueOnce(universe.promise);
    const pending = service.ordersClose(
      [{ assetId: 0, isBuy: true, size: '0.1', midPx: '100' }],
      { expectedAccountAddress: ADDRESS_A, tradingUiMode: 'simple' },
    );
    await flush();
    expect(getTradingUniverse).toHaveBeenCalledTimes(1);
    await switchTo(ADDRESS_B);
    universe.resolve(tradingUniverse);
    await expect(pending).rejects.toThrow(accountChangedMessage);
    expect(orderCalls()).toBe(0);
  });

  it('binds a plain order open to the account that was active when it started', async () => {
    const universe = createDeferred<typeof tradingUniverse>();
    getTradingUniverse.mockReturnValueOnce(universe.promise);

    const pending = service.orderOpen({
      assetId: 0,
      isBuy: true,
      size: '0.1',
      price: '100',
      type: 'limit',
      tif: 'Gtc',
    });
    await flush();
    expect(getTradingUniverse).toHaveBeenCalledTimes(1);

    await switchTo(ADDRESS_B);
    universe.resolve(tradingUniverse);

    await expect(pending).rejects.toThrow(accountChangedMessage);
    expect(orderCalls()).toBe(0);
  });
});

describe('exchange order account guard', () => {
  function createService() {
    const response = {
      status: 'ok',
      response: { type: 'order', data: { statuses: [] } },
    };
    const client = { order: jest.fn().mockResolvedValue(response) };
    const service = {
      _account: '0xagent',
      _userAddress: '0xUSER',
      _exchangeClient: client,
      checkAccountCanTrade: jest.fn(),
      _resolveExpectedAccountAddress: jest.fn().mockResolvedValue('0xuser'),
      _formatOrdersForHyperLiquid: jest.fn().mockResolvedValue([]),
      getExchangeClientForTrading: jest.fn().mockResolvedValue(client),
      _buildLogContext: jest.fn().mockResolvedValue({}),
      _composeOrderLogExtra: jest.fn(),
      _resolveOrderOpenIsFirstTime: jest.fn(),
      _markOrderOpenSucceeded: jest.fn(),
      backgroundApi: {
        serviceRookieGuide: { recordTaskCompleted: jest.fn() },
      },
    };
    const submit = () =>
      ServiceHyperliquidExchange.prototype.placeOrderRaw.call(
        service as unknown as ServiceHyperliquidExchange,
        { orders: [], grouping: 'na' },
        { expectedAccountAddress: '0xuser' },
      );
    return { service, client, submit, response };
  }

  const previousScope = globalThis.$onekeyIsInBackground;
  afterEach(() => {
    globalThis.$onekeyIsInBackground = previousScope;
  });

  beforeEach(() => {
    globalThis.$onekeyIsInBackground = true;
    mockActiveAccountState.value = {
      accountAddress: '0xuser',
    };
  });

  it('accepts an agent signer serving the expected user', async () => {
    const { submit, client, response } = createService();
    await expect(submit()).resolves.toEqual(response);
    expect(client.order).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed selected account before dispatch', async () => {
    mockActiveAccountState.value = {
      accountAddress: '0xother',
    };
    const { submit, client } = createService();
    await expect(submit()).rejects.toThrow(accountChangedMessage);
    expect(client.order).not.toHaveBeenCalled();
  });

  it('accepts a wallet signing directly for the expected user', async () => {
    const { submit, service, client } = createService();
    service._account = '0xuser';
    await submit();
    expect(client.order).toHaveBeenCalledTimes(1);
  });

  it('clears client ownership when disposed', async () => {
    const { service } = createService();
    await ServiceHyperliquidExchange.prototype.dispose.call(
      service as unknown as ServiceHyperliquidExchange,
    );
    expect(service._userAddress).toBeNull();
    expect(service._exchangeClient).toBeNull();
  });

  it('rejects a client belonging to another user', async () => {
    const { submit, service, client } = createService();
    service._userAddress = '0xother';
    await expect(submit()).rejects.toThrow(accountChangedMessage);
    expect(client.order).not.toHaveBeenCalled();
  });

  it('rejects a client replaced while order preparation is awaiting', async () => {
    const { submit, service, client } = createService();
    service._buildLogContext.mockImplementation(async () => {
      service._exchangeClient = { order: jest.fn() };
      return {};
    });
    await expect(submit()).rejects.toThrow(accountChangedMessage);
    expect(client.order).not.toHaveBeenCalled();
  });
});
