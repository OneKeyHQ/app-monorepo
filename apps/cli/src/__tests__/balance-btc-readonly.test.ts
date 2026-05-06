import { registerBalanceCommand } from '../commands/balance';
import { apiClient } from '../infra';
import { createTestProgram, runCommand } from './test-helpers';

jest.mock('../infra', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    setEnv: jest.fn(),
  },
}));

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

describe('balance BTC/TBTC read-only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries tbtc native balance by explicit address', async () => {
    mockGet.mockResolvedValueOnce({
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      balance: '12345',
      balanceParsed: '0.00012345',
    });

    const program = createTestProgram();
    registerBalanceCommand(program);

    const result = await runCommand(program, [
      'balance',
      '--chain',
      'tbtc',
      '--address',
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);
    expect(mockGet).toHaveBeenCalledWith(
      'wallet',
      '/wallet/v1/account/get-account',
      {
        networkId: 'tbtc--0',
        accountAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        withNetWorth: true,
      },
    );
    expect(result.stdout).toContain('0.00012345');
  });

  it('requires address for tbtc balance in the first round', async () => {
    const program = createTestProgram();
    registerBalanceCommand(program);

    const result = await runCommand(program, [
      'balance',
      '--chain',
      'tbtc',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('requires --address');
  });

  it('rejects non-native token for tbtc', async () => {
    const program = createTestProgram();
    registerBalanceCommand(program);

    const result = await runCommand(program, [
      'balance',
      '--chain',
      'tbtc',
      '--address',
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      '--token',
      'USDC',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain(
      'Only native BTC/TBTC balance is supported',
    );
  });
});
