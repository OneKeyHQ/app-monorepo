jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const passthrough =
    () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
      descriptor;
  return {
    ...actual,
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
  };
});

const mockGetVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: mockGetVault },
}));
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

// The Verify button: funds that only need the password to be shown unspent.
describe('Privacy password verification on request', () => {
  const params = { networkId: 'xmr--0', accountId: 'account' };

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createService(hasWork: boolean) {
    const localWalletDoPasswordWork = jest.fn(async () => true);
    mockGetVault.mockResolvedValue({
      localWalletHasPasswordWork: async () => hasWork,
      localWalletDoPasswordWork,
    });
    const promptPasswordVerifyByAccount = jest.fn(async () => ({
      password: 'synthetic-test-password',
    }));
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        verifyLocalWalletWithPassword: (p: typeof params) => Promise<void>;
      },
      { backgroundApi: { servicePassword: { promptPasswordVerifyByAccount } } },
    );
    return {
      service,
      localWalletDoPasswordWork,
      promptPasswordVerifyByAccount,
    };
  }

  it('asks for the password and uses it, cached or not', async () => {
    const {
      service,
      localWalletDoPasswordWork,
      promptPasswordVerifyByAccount,
    } = createService(true);

    await service.verifyLocalWalletWithPassword(params);

    expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
    expect(localWalletDoPasswordWork).toHaveBeenCalledWith({
      password: 'synthetic-test-password',
    });
  });

  it('does not ask when nothing needs the password', async () => {
    const { service, promptPasswordVerifyByAccount } = createService(false);

    await service.verifyLocalWalletWithPassword(params);

    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });
});
