import { buildAccountSelectorAccountsValuesDataOnce } from './accountSelectorValuesRequest';

const mockBuildValues = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccountSelector: {
      buildAccountSelectorAccountsValuesData: (...args: unknown[]) =>
        mockBuildValues(...args) as unknown,
    },
  },
}));

const params = {
  accounts: [{ accountId: 'hd-1--0', networkId: 'evm--1' }],
  linkedNetworkId: 'onekeyall--0',
};

describe('buildAccountSelectorAccountsValuesDataOnce', () => {
  beforeEach(() => {
    mockBuildValues.mockReset();
  });

  it('shares a request while an equivalent payload is in flight', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    mockBuildValues.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const first = buildAccountSelectorAccountsValuesDataOnce(params);
    const second = buildAccountSelectorAccountsValuesDataOnce({
      linkedNetworkId: params.linkedNetworkId,
      accounts: params.accounts.map((account) => ({ ...account })),
    });

    expect(second).toBe(first);
    expect(mockBuildValues).toHaveBeenCalledTimes(1);

    resolveRequest?.({ accountsValue: [], accountsDeFiOverview: [] });
    await first;
  });

  it('starts a new request after the previous request settles', async () => {
    mockBuildValues.mockResolvedValue({
      accountsValue: [],
      accountsDeFiOverview: [],
    });

    await buildAccountSelectorAccountsValuesDataOnce(params);
    await buildAccountSelectorAccountsValuesDataOnce(params);

    expect(mockBuildValues).toHaveBeenCalledTimes(2);
  });
});
