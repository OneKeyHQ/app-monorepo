import type { IWithdrawParams } from '@onekeyhq/shared/types/hyperliquid/types';

import ServiceHyperliquidExchange from './ServiceHyperliquidExchange';
import {
  getLiveUsdcWithdrawRoute,
  getUsdcWithdrawRoute,
} from './usdcWithdrawRoute';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const policy: { withdrawChannel?: 'cctp' | 'legacy' } = {};
const address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const withdraw3 = jest.fn();
const sendAsset = jest.fn();
const sendToEvmWithData = jest.fn();
const getAddress = jest.fn();
const proxyRPCCall = jest.fn();
const refreshConfig = jest.fn();
const preTransferCheck = jest.fn();

jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn(),
  ExchangeClient: jest.fn().mockImplementation(() => ({
    withdraw3,
    sendAsset,
    sendToEvmWithData,
  })),
}));
jest.mock('./usdcWithdrawRoute', () => ({
  getUsdcWithdrawRoute: jest.fn(),
  getLiveUsdcWithdrawRoute: jest.fn(),
}));
jest.mock('./hyperLiquidApiClients', () => ({
  hyperLiquidApiClients: {
    get infoClient() {
      return { preTransferCheck };
    },
  },
}));
jest.mock('../../states/jotai/atoms', () => ({
  perpsCommonConfigPersistAtom: {
    get: async () => ({ perpConfigCommon: { ...policy } }),
  },
  perpsActiveAccountAtom: { get: async () => ({ accountAddress: address }) },
  perpsAbstractionModeAtom: {
    get: async () => ({ accountAddress: address, mode: 'unifiedAccount' }),
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    perp: { hyperliquid: new Proxy({}, { get: () => jest.fn() }) },
  },
}));

const params: IWithdrawParams = {
  userAccountId: 'wallet-a',
  destinationId: 'arbitrum',
  amount: '10',
  expectedRoute: 'bridge',
};

describe('USDC withdrawal emergency policy', () => {
  let service: ServiceHyperliquidExchange;
  const previousScope = globalThis.$onekeyIsInBackground;
  beforeEach(() => {
    globalThis.$onekeyIsInBackground = true;
    jest.clearAllMocks();
    [
      withdraw3,
      sendAsset,
      sendToEvmWithData,
      getAddress,
      proxyRPCCall,
      refreshConfig,
    ].forEach((mock) => mock.mockReset());
    policy.withdrawChannel = undefined;
    getAddress.mockResolvedValue(address);
    proxyRPCCall.mockResolvedValue(['0x30d40']);
    withdraw3.mockResolvedValue({
      status: 'ok',
      response: { type: 'default' },
    });
    sendAsset.mockResolvedValue({
      status: 'ok',
      response: { type: 'default' },
    });
    sendToEvmWithData.mockResolvedValue({
      status: 'ok',
      response: { type: 'default' },
    });
    jest.mocked(getUsdcWithdrawRoute).mockResolvedValue('cctp');
    jest.mocked(getLiveUsdcWithdrawRoute).mockResolvedValue('cctp');
    service = new ServiceHyperliquidExchange({
      backgroundApi: {
        serviceHyperliquid: {
          updatePerpsConfigByServerSilently: refreshConfig,
        },
        serviceHyperliquidWallet: {
          getOnekeyWallet: async () => ({ getAddress }),
        },
        serviceDApp: { proxyRPCCall },
      } as unknown as IBackgroundApi,
    });
  });
  afterEach(() => {
    globalThis.$onekeyIsInBackground = previousScope;
  });

  it.each([undefined, 'cctp'] as const)(
    'follows Hyperliquid when the switch is %s',
    async (value) => {
      policy.withdrawChannel = value;
      await expect(
        service.getUsdcWithdrawRoute({ forceRefresh: true }),
      ).resolves.toBe('cctp');
      expect(refreshConfig).toHaveBeenCalledWith({ ignoreCache: true });
    },
  );

  it('displays and submits the bridge without any CCTP dependency', async () => {
    policy.withdrawChannel = 'legacy';
    await expect(
      service.getUsdcWithdrawRoute({ forceRefresh: true }),
    ).resolves.toBe('bridge');
    await service.withdraw(params);
    expect(withdraw3).toHaveBeenCalledWith({
      amount: '10',
      destination: address,
    });
    expect(getUsdcWithdrawRoute).not.toHaveBeenCalled();
    expect(getLiveUsdcWithdrawRoute).not.toHaveBeenCalled();
    expect(proxyRPCCall).not.toHaveBeenCalled();
    expect(preTransferCheck).not.toHaveBeenCalled();
    expect(sendAsset).not.toHaveBeenCalled();
    expect(sendToEvmWithData).not.toHaveBeenCalled();
  });

  it.each(['base', 'ethereum', 'hyperevm'] as const)(
    'rejects a stale %s form under the override',
    async (destinationId) => {
      policy.withdrawChannel = 'legacy';
      await expect(
        service.withdraw({ ...params, destinationId }),
      ).rejects.toThrow('Withdrawal route changed');
      expect(withdraw3).not.toHaveBeenCalled();
      expect(sendAsset).not.toHaveBeenCalled();
      expect(sendToEvmWithData).not.toHaveBeenCalled();
    },
  );

  it('does not charge the bridge fee against a CCTP confirmation', async () => {
    policy.withdrawChannel = 'legacy';
    await expect(
      service.withdraw({ ...params, expectedRoute: 'cctp' }),
    ).rejects.toThrow('Withdrawal route changed');
    expect(withdraw3).not.toHaveBeenCalled();
  });

  it('restores live CCTP routing and fee checks after the override is removed', async () => {
    policy.withdrawChannel = 'cctp';
    await expect(service.withdraw(params)).rejects.toThrow(
      'Withdrawal route changed',
    );
    await service.withdraw({
      ...params,
      expectedRoute: 'cctp',
      expectedCctpFee: '0.2',
    });
    expect(proxyRPCCall).toHaveBeenCalled();
    expect(sendToEvmWithData).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '10', sourceDex: 'spot' }),
    );
    expect(withdraw3).not.toHaveBeenCalled();
  });

  it('rejects a policy change during fee preparation before signing', async () => {
    proxyRPCCall.mockImplementation(async () => {
      policy.withdrawChannel = 'legacy';
      return ['0x30d40'];
    });
    await expect(
      service.withdraw({
        ...params,
        expectedRoute: 'cctp',
        expectedCctpFee: '0.2',
      }),
    ).rejects.toThrow('Withdrawal route changed');
    expect(sendToEvmWithData).not.toHaveBeenCalled();
    expect(withdraw3).not.toHaveBeenCalled();
  });

  it('rejects removal of the override during wallet preparation', async () => {
    policy.withdrawChannel = 'legacy';
    getAddress.mockImplementation(async () => {
      policy.withdrawChannel = 'cctp';
      return address;
    });
    await expect(service.withdraw(params)).rejects.toThrow(
      'Withdrawal route changed',
    );
    expect(withdraw3).not.toHaveBeenCalled();
  });

  it('does not let a late normal route lookup override the emergency policy', async () => {
    jest.mocked(getUsdcWithdrawRoute).mockImplementation(async () => {
      policy.withdrawChannel = 'legacy';
      return 'cctp';
    });
    await expect(service.getUsdcWithdrawRoute()).resolves.toBe('bridge');
  });

  it('does not resubmit a failed signed action on another rail', async () => {
    policy.withdrawChannel = 'legacy';
    withdraw3.mockRejectedValueOnce(new Error('network timeout'));
    await expect(service.withdraw(params)).rejects.toThrow();
    expect(withdraw3).toHaveBeenCalledTimes(1);
    expect(sendToEvmWithData).not.toHaveBeenCalled();
  });
});
