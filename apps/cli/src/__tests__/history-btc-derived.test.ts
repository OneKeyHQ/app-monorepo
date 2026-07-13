import { registerWalletHistoryCommand } from '../commands/wallet-history';
import { fetchHistory, formatHistoryList } from '../core/history-fetcher';
import { getSignerByImpl } from '../signer';

import { createTestProgram, extractJson, runCommand } from './test-helpers';

jest.mock('../core/history-fetcher', () => ({
  fetchHistory: jest.fn(),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  formatHistoryList: jest.fn((resp) => resp.data),
}));

jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(),
}));

const mockFetchHistory = fetchHistory as jest.MockedFunction<
  typeof fetchHistory
>;
const mockFormatHistoryList = formatHistoryList as jest.MockedFunction<
  typeof formatHistoryList
>;
const mockGetSignerByImpl = getSignerByImpl as jest.MockedFunction<
  typeof getSignerByImpl
>;

describe('history BTC/TBTC derived wallet reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('flattens, sorts, and globally limits canonical tbtc address histories when address is omitted', async () => {
    const getAddress = jest
      .fn()
      .mockResolvedValueOnce({ address: 'tb1ptaproot' })
      .mockResolvedValueOnce({ address: 'tb1qnative' })
      .mockResolvedValueOnce({ address: '2Nnested' })
      .mockResolvedValueOnce({ address: 'mlegacy' });
    mockGetSignerByImpl.mockResolvedValue({
      getAddress,
      signTransaction: jest.fn(),
      signMessage: jest.fn(),
    });
    mockFetchHistory
      .mockResolvedValueOnce({
        data: [
          { txHash: 'taproot-old', timestamp: '2026-05-01T00:00:00.000Z' },
        ],
        hasMore: false,
      } as never)
      .mockResolvedValueOnce({
        data: [
          { txHash: 'native-new', timestamp: '2026-05-03T00:00:00.000Z' },
          { txHash: 'native-mid', timestamp: '2026-05-02T00:00:00.000Z' },
        ],
        hasMore: false,
      } as never)
      .mockResolvedValueOnce({ data: [], hasMore: false } as never)
      .mockResolvedValueOnce({
        data: [{ txHash: 'legacy-no-time' }],
        hasMore: false,
      } as never);

    const program = createTestProgram();
    registerWalletHistoryCommand(program);

    const result = await runCommand(program, [
      'history',
      '--chain',
      'tbtc',
      '--limit',
      '2',
      '--detail',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);
    expect(mockGetSignerByImpl).toHaveBeenCalledWith('tbtc');
    expect(mockGetSignerByImpl).toHaveBeenCalledTimes(1);
    expect(getAddress).toHaveBeenNthCalledWith(1, 'tbtc--0', {
      addressType: 'taproot',
    });
    expect(getAddress).toHaveBeenNthCalledWith(2, 'tbtc--0', {
      addressType: 'native-segwit',
    });
    expect(getAddress).toHaveBeenNthCalledWith(3, 'tbtc--0', {
      addressType: 'nested-segwit',
    });
    expect(getAddress).toHaveBeenNthCalledWith(4, 'tbtc--0', {
      addressType: 'legacy',
    });
    expect(mockFetchHistory).toHaveBeenCalledTimes(4);
    expect(mockFormatHistoryList).toHaveBeenCalledTimes(4);
    expect(mockFormatHistoryList).toHaveBeenCalledWith(
      expect.any(Object),
      true,
    );

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data).toEqual({
      chain: 'tbtc',
      aggregate: true,
      items: [
        {
          txHash: 'native-new',
          timestamp: '2026-05-03T00:00:00.000Z',
          networkName: 'TBTC',
        },
        {
          txHash: 'native-mid',
          timestamp: '2026-05-02T00:00:00.000Z',
          networkName: 'TBTC',
        },
      ],
      addressTypes: [
        {
          addressType: 'taproot',
          label: 'Taproot',
          address: 'tb1ptaproot',
          count: 1,
        },
        {
          addressType: 'native-segwit',
          label: 'Native SegWit',
          address: 'tb1qnative',
          count: 2,
        },
        {
          addressType: 'nested-segwit',
          label: 'Nested SegWit',
          address: '2Nnested',
          count: 0,
        },
        {
          addressType: 'legacy',
          label: 'Legacy',
          address: 'mlegacy',
          count: 1,
        },
      ],
    });
  });

  it('keeps external address history output as an array', async () => {
    mockFetchHistory.mockResolvedValueOnce({
      data: [{ txHash: 'external', timestamp: '2026-05-01T00:00:00.000Z' }],
      hasMore: false,
    } as never);

    const program = createTestProgram();
    registerWalletHistoryCommand(program);

    const result = await runCommand(program, [
      'history',
      '--chain',
      'tbtc',
      '--address',
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      '--limit',
      '5',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);
    expect(mockFetchHistory).toHaveBeenCalledWith({
      networkId: 'tbtc--0',
      accountAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      tokenAddress: undefined,
      limit: 5,
    });

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data).toEqual([
      { txHash: 'external', timestamp: '2026-05-01T00:00:00.000Z' },
    ]);
  });

  it('rejects address and address-type together', async () => {
    const program = createTestProgram();
    registerWalletHistoryCommand(program);

    const result = await runCommand(program, [
      'history',
      '--chain',
      'tbtc',
      '--address',
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      '--address-type',
      'taproot',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.message).toContain(
      '--address cannot be used with --address-type',
    );
  });

  it('rejects token filters for derived tbtc history', async () => {
    const program = createTestProgram();
    registerWalletHistoryCommand(program);

    const result = await runCommand(program, [
      'history',
      '--chain',
      'tbtc',
      '--token',
      'TBTC',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.message).toContain('Token filtering is not supported');
  });
});
