import {
  getTaskAccountAddress,
  isTaskAccountAddress,
  isTaskAccountCurrent,
  normalizeTaskAccountAddress,
} from './taskAccount';

const mockGetAccountAddressForApi = jest.fn<
  Promise<string>,
  [{ accountId: string; networkId: string }]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountAddressForApi: (params: {
        accountId: string;
        networkId: string;
      }) => mockGetAccountAddressForApi(params),
    },
  },
}));

describe('task account address identity', () => {
  it('normalizes EVM address casing', () => {
    expect(normalizeTaskAccountAddress('evm--1', '0xAbC')).toBe('0xabc');
    expect(
      isTaskAccountAddress(
        { networkId: 'evm--1', accountAddress: '0xAbC' },
        '0xaBc',
      ),
    ).toBe(true);
  });

  it('preserves case-sensitive addresses on other networks', () => {
    expect(normalizeTaskAccountAddress('sol--101', 'AbC')).toBe('AbC');
    expect(
      isTaskAccountAddress(
        { networkId: 'sol--101', accountAddress: 'AbC' },
        'abc',
      ),
    ).toBe(false);
  });
});

describe('current task account', () => {
  beforeEach(() => {
    mockGetAccountAddressForApi.mockReset();
  });

  it('compares the address for the task account and network', async () => {
    mockGetAccountAddressForApi.mockResolvedValue('0xaBc');
    const identity = {
      accountId: 'account-1',
      networkId: 'evm--1',
      accountAddress: '0xAbC',
    };
    await expect(isTaskAccountCurrent(identity)).resolves.toBe(true);
    expect(mockGetAccountAddressForApi).toHaveBeenCalledWith({
      accountId: 'account-1',
      networkId: 'evm--1',
    });
    mockGetAccountAddressForApi.mockResolvedValueOnce('0xOther');
    await expect(isTaskAccountCurrent(identity)).resolves.toBe(false);
  });

  it('rejects a missing account address', async () => {
    mockGetAccountAddressForApi.mockResolvedValue('  ');
    await expect(
      getTaskAccountAddress({ accountId: 'account-1', networkId: 'evm--1' }),
    ).rejects.toThrow('Missing task account address');
  });
});
