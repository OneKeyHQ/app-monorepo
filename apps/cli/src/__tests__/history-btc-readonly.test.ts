import { registerWalletHistoryCommand } from '../commands/wallet-history';
import { fetchHistory } from '../core/history-fetcher';
import { createTestProgram, runCommand } from './test-helpers';

jest.mock('../core/history-fetcher', () => ({
  fetchHistory: jest.fn(),
  formatHistoryList: jest.fn(() => []),
}));

const mockFetchHistory = fetchHistory as jest.MockedFunction<
  typeof fetchHistory
>;

describe('history BTC/TBTC read-only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchHistory.mockResolvedValue({
      items: [],
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

  it('requires address for tbtc history in the first round', async () => {
    const program = createTestProgram();
    registerWalletHistoryCommand(program);

    const result = await runCommand(program, [
      'history',
      '--chain',
      'tbtc',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('requires --address');
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
