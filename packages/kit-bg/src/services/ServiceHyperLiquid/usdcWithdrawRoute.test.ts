import {
  USDC_WITHDRAW_DESTINATIONS,
  USDC_WITHDRAW_GAS_RESERVE,
  getUsdcWithdrawDestination,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import {
  buildCctpWithdrawDestination,
  clearUsdcWithdrawFeeCacheForTest,
  getLiveUsdcWithdrawFee,
  getUsdcWithdrawFee,
} from './cctpWithdraw';
import {
  clearUsdcWithdrawRouteCacheForTest,
  getLiveUsdcWithdrawRoute,
  getUsdcWithdrawRoute,
} from './usdcWithdrawRoute';

const requestMock = jest.fn<Promise<unknown>, unknown[]>();
const rpcCallMock = jest.fn<Promise<unknown>, [string, unknown[]]>();

jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn().mockImplementation(() => ({
    request: (...args: unknown[]) => requestMock(...args),
  })),
}));

describe('usdc withdraw route resolution', () => {
  beforeEach(() => {
    clearUsdcWithdrawRouteCacheForTest();
    requestMock.mockReset();
  });

  it('follows the rail Hyperliquid is serving', async () => {
    requestMock.mockResolvedValue({
      depositRoute: 'cctp',
      withdrawalRoute: 'cctp',
    });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');
    expect(requestMock).toHaveBeenCalledWith('info', { type: 'usdcRouting' });
  });

  it('follows a switch back to the legacy bridge', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'bridge' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('bridge');
  });

  // A rail we do not implement must not be forwarded to the exchange call.
  it('falls back to the legacy bridge for an unrecognized rail', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'something-new' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('bridge');
  });

  it('falls back to the legacy bridge when the request fails', async () => {
    requestMock.mockRejectedValue(new Error('network down'));
    await expect(getUsdcWithdrawRoute()).resolves.toBe('bridge');
  });

  it('caches the resolved rail instead of asking on every withdrawal', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'cctp' });
    await getUsdcWithdrawRoute();
    await getUsdcWithdrawRoute();
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('reuses the resolved rail for five minutes', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      requestMock
        .mockResolvedValueOnce({ withdrawalRoute: 'cctp' })
        .mockResolvedValueOnce({ withdrawalRoute: 'bridge' });

      await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');
      nowSpy.mockReturnValue(1000 + 5 * 60 * 1000 - 1);
      await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');
      expect(requestMock).toHaveBeenCalledTimes(1);

      nowSpy.mockReturnValue(1000 + 5 * 60 * 1000);
      await expect(getUsdcWithdrawRoute()).resolves.toBe('bridge');
      expect(requestMock).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('bypasses the cached rail when a live refresh is requested', async () => {
    requestMock
      .mockResolvedValueOnce({ withdrawalRoute: 'cctp' })
      .mockResolvedValueOnce({ withdrawalRoute: 'bridge' });

    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');
    await expect(getUsdcWithdrawRoute({ forceRefresh: true })).resolves.toBe(
      'bridge',
    );
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  // Caching a failure would pin later withdrawals to the pricier rail.
  it('retries after a failed lookup', async () => {
    requestMock.mockRejectedValueOnce(new Error('network down'));
    await expect(getUsdcWithdrawRoute()).resolves.toBe('bridge');
    requestMock.mockResolvedValue({ withdrawalRoute: 'cctp' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  // One failed lookup must not quadruple the user's fee.
  it('keeps the last confirmed rail when a later lookup fails', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'cctp' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000);
    requestMock.mockRejectedValue(new Error('network down'));
    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');
    jest.spyOn(Date, 'now').mockRestore();
  });

  // An unreadable 200 is not a rail change.
  it('keeps the confirmed rail when a later response is unreadable', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'cctp' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + 10 * 60 * 1000);
    requestMock.mockResolvedValue({ status: 'err', response: 'boom' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');

    // Still not cached, so the next lookup asks again rather than serving it.
    requestMock.mockResolvedValue({ withdrawalRoute: 'bridge' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('bridge');
    nowSpy.mockRestore();
  });

  it('shares one in-flight lookup between concurrent callers', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'cctp' });
    const [first, second] = await Promise.all([
      getUsdcWithdrawRoute(),
      getUsdcWithdrawRoute(),
    ]);
    expect([first, second]).toEqual(['cctp', 'cctp']);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes the live rail before submission instead of using the UI cache', async () => {
    requestMock.mockResolvedValueOnce({ withdrawalRoute: 'cctp' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');

    requestMock.mockResolvedValueOnce({ withdrawalRoute: 'bridge' });
    await expect(getLiveUsdcWithdrawRoute()).resolves.toBe('bridge');
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('rejects an unknown live rail instead of silently falling back', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'something-new' });
    await expect(getLiveUsdcWithdrawRoute()).rejects.toThrow(
      'Unsupported Hyperliquid withdrawal route',
    );
  });
});

describe('usdc withdraw destinations and fees', () => {
  beforeEach(() => {
    clearUsdcWithdrawFeeCacheForTest();
    rpcCallMock.mockReset();
  });

  it('supports HyperEVM instead of Solana', () => {
    expect(USDC_WITHDRAW_DESTINATIONS.map((item) => item.id)).toEqual([
      'ethereum',
      'avalanche',
      'optimism',
      'arbitrum',
      'base',
      'hyperevm',
    ]);
    expect(getUsdcWithdrawDestination('solana')).toBeUndefined();
    expect(getUsdcWithdrawDestination('hyperevm')).toEqual({
      id: 'hyperevm',
      name: 'HyperEVM',
      networkId: 'evm--999',
      transferType: 'hyperEvm',
      signatureChainId: '0xa4b1',
    });
    expect(
      USDC_WITHDRAW_DESTINATIONS.filter(
        (item) => item.transferType === 'cctp',
      ).map((item) => [item.id, item.domain, item.fallbackFee]),
    ).toEqual([
      ['ethereum', 0, 1.2],
      ['avalanche', 1, 0.2],
      ['optimism', 2, 0.2],
      ['arbitrum', 3, 0.2],
      ['base', 6, 0.2],
    ]);
  });

  it('builds the selected external CCTP destination', () => {
    expect(
      buildCctpWithdrawDestination({
        destinationId: 'arbitrum',
        ownerAddress: '0x0000000000000000000000000000000000000001',
      }),
    ).toMatchObject({
      destinationRecipient: '0x0000000000000000000000000000000000000001',
      addressEncoding: 'hex',
      destinationChainId: 3,
      gasLimit: 200_000,
      data: '0x',
    });
    expect(() =>
      buildCctpWithdrawDestination({
        destinationId: 'hyperevm',
        ownerAddress: '0x0000000000000000000000000000000000000001',
      }),
    ).toThrow('Destination does not use CCTP: hyperevm');
  });

  it('quotes only the CCTP forwarding fee through RPC', async () => {
    rpcCallMock.mockResolvedValue('0x30d40');

    await expect(getUsdcWithdrawFee('arbitrum', rpcCallMock)).resolves.toEqual({
      components: [
        {
          kind: 'cctpForwarding',
          amount: '0.2',
          token: 'USDC',
          debitedFrom: 'withdrawAmount',
          isEstimate: false,
        },
      ],
      quotedAt: expect.any(Number),
    });
    expect(rpcCallMock).toHaveBeenCalledTimes(1);
    expect(rpcCallMock.mock.calls.map(([method]) => method)).toEqual([
      'eth_call',
    ]);
    const cctpRequest = rpcCallMock.mock.calls.find(
      ([method]) => method === 'eth_call',
    );
    expect((cctpRequest?.[1][0] as { data: string }).data).toBe(
      `0xe26f7d23${'1'.padStart(64, '0')}${'3'.padStart(64, '0')}`,
    );
  });

  it('marks the CCTP fallback as estimated', async () => {
    rpcCallMock.mockRejectedValue(new Error('network down'));
    await expect(getUsdcWithdrawFee('ethereum', rpcCallMock)).resolves.toEqual({
      components: [
        {
          kind: 'cctpForwarding',
          amount: '1.2',
          token: 'USDC',
          debitedFrom: 'withdrawAmount',
          isEstimate: true,
        },
      ],
      quotedAt: expect.any(Number),
    });
  });

  it('shows a sub-cent HyperEVM fee without making an RPC call', async () => {
    await expect(getUsdcWithdrawFee('hyperevm', rpcCallMock)).resolves.toEqual({
      components: [
        {
          kind: 'hyperEvmGas',
          amount: USDC_WITHDRAW_GAS_RESERVE.toString(),
          token: 'USDC',
          debitedFrom: 'spotHypeOrSourceUsdc',
          isEstimate: true,
          displayAsLessThan: true,
        },
      ],
      quotedAt: expect.any(Number),
    });
    expect(rpcCallMock).not.toHaveBeenCalled();
  });

  it('does not use an estimated fallback for the submission fee check', async () => {
    rpcCallMock.mockRejectedValue(new Error('network down'));
    await expect(
      getLiveUsdcWithdrawFee('arbitrum', rpcCallMock),
    ).rejects.toThrow('network down');
  });
});
