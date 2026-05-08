import { registerWalletHistoryCommand } from '../commands/wallet-history';
import { fetchHistory } from '../core/history-fetcher';
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
const mockGetSignerByImpl = getSignerByImpl as jest.MockedFunction<
  typeof getSignerByImpl
>;

describe('history BTC/TBTC read-only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchHistory.mockResolvedValue({
      data: [],
      hasMore: false,
    } as never);
  });

  it('queries tbtc history by explicit address', async () => {
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
  });

  it('derives tbtc history when address is omitted', async () => {
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
    mockFetchHistory.mockResolvedValue({
      data: [],
      hasMore: false,
    } as never);

    const program = createTestProgram();
    registerWalletHistoryCommand(program);

    const result = await runCommand(program, [
      'history',
      '--chain',
      'tbtc',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);
    expect(mockFetchHistory).toHaveBeenCalledTimes(4);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data.aggregate).toBe(true);
    expect(parsed.data.addressTypes).toHaveLength(4);
  });

  it('rejects token filters for tbtc history', async () => {
    const program = createTestProgram();
    registerWalletHistoryCommand(program);

    const result = await runCommand(program, [
      'history',
      '--chain',
      'tbtc',
      '--address',
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      '--token',
      'TBTC',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('Token filtering is not supported');
  });
});
