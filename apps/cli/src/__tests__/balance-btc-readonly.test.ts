import { registerBalanceCommand } from '../commands/balance';
import { apiClient } from '../infra';
import { getSignerByImpl } from '../signer';

import { createTestProgram, extractJson, runCommand } from './test-helpers';

jest.mock('../infra', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    setEnv: jest.fn(),
  },
}));

jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockGetSignerByImpl = getSignerByImpl as jest.MockedFunction<
  typeof getSignerByImpl
>;

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

  it('derives tbtc balance when address is omitted', async () => {
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
    mockGet.mockResolvedValue({
      balance: '1000',
      balanceParsed: '0.00001',
    });

    const program = createTestProgram();
    registerBalanceCommand(program);

    const result = await runCommand(program, [
      'balance',
      '--chain',
      'tbtc',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data.aggregate.balance).toBe('0.00004');
    expect(parsed.data.items).toHaveLength(4);
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
