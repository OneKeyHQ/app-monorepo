import ServiceHyperliquidExchange from './ServiceHyperliquidExchange';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const preTransferCheck = jest.fn<
  Promise<unknown>,
  [{ source: string; user: string }]
>();
jest.mock('./hyperLiquidApiClients', () => ({
  hyperLiquidApiClients: {
    get infoClient() {
      return { preTransferCheck };
    },
  },
}));
jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn(),
  ExchangeClient: jest.fn(),
}));
jest.mock('../../states/jotai/atoms', () => ({}));

const accountAddress = `0x${'a'.repeat(40)}` as const;
const getAddress = jest.fn().mockResolvedValue(accountAddress);
const getOnekeyWallet = jest.fn().mockResolvedValue({ getAddress });
const response = {
  fee: '1',
  isSanctioned: false,
  userExists: true,
  userHasSentTx: false,
};

describe('USDC withdrawal reserve', () => {
  let service: ServiceHyperliquidExchange;
  const previousScope = globalThis.$onekeyIsInBackground;

  beforeEach(() => {
    globalThis.$onekeyIsInBackground = true;
    jest.clearAllMocks();
    getAddress.mockResolvedValue(accountAddress);
    preTransferCheck.mockResolvedValue(response);
    service = new ServiceHyperliquidExchange({
      backgroundApi: {
        serviceHyperliquidWallet: { getOnekeyWallet },
      } as unknown as IBackgroundApi,
    });
  });
  afterEach(() => {
    globalThis.$onekeyIsInBackground = previousScope;
  });

  it.each([
    ['0', '0.01'],
    ['1', '1'],
    ['0.5', '0.5'],
    ['0.001', '0.01'],
    ['1.2345678', '1.2345678'],
  ])('uses fee %s as a total reserve of %s', async (fee, reserve) => {
    preTransferCheck.mockResolvedValue({ ...response, fee });
    await expect(
      service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
    ).resolves.toEqual({ accountAddress, reserve });
    expect(getOnekeyWallet).toHaveBeenCalledWith({ userAccountId: 'wallet-a' });
    expect(preTransferCheck).toHaveBeenCalledWith({
      source: accountAddress,
      user: '0x2000000000000000000000000000000000000000',
    });
  });

  it.each([undefined, null, 0, '', '-1', 'NaN', 'Infinity', '0x1', '1e2'])(
    'does not provide a usable reserve for invalid fee %s',
    async (fee) => {
      preTransferCheck.mockResolvedValue({ ...response, fee });
      await expect(
        service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
      ).resolves.toBeUndefined();
    },
  );

  it('does not provide a usable reserve for a restricted transfer', async () => {
    preTransferCheck.mockResolvedValue({ ...response, isSanctioned: true });
    await expect(
      service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
    ).resolves.toBeUndefined();
  });

  it('returns the resolved wallet identity on every refresh', async () => {
    await service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' });
    const nextAddress = `0x${'b'.repeat(40)}`;
    getAddress.mockResolvedValue(nextAddress);
    await expect(
      service.getUsdcWithdrawReserve({ userAccountId: 'wallet-b' }),
    ).resolves.toEqual({ accountAddress: nextAddress, reserve: '1' });
    expect(preTransferCheck).toHaveBeenLastCalledWith({
      source: nextAddress,
      user: '0x2000000000000000000000000000000000000000',
    });
  });

  it('leaves retry feedback to the form when the request fails', async () => {
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      preTransferCheck.mockRejectedValueOnce(new Error('offline'));
      await expect(
        service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
      ).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalled();
    } finally {
      logError.mockRestore();
    }
  });
});
