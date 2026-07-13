const mockCoreInit = jest.fn();
const mockSignClientInit = jest.fn();
const mockWalletKitInit = jest.fn();

jest.mock('@walletconnect/core', () => ({
  Core: {
    init: (...args: unknown[]): Promise<unknown> =>
      mockCoreInit(...args) as Promise<unknown>,
  },
}));

jest.mock('@walletconnect/keyvaluestorage', () => {
  class KeyValueStorage {}
  return {
    __esModule: true,
    default: KeyValueStorage,
    KeyValueStorage,
  };
});

jest.mock('@walletconnect/sign-client', () => ({
  __esModule: true,
  default: {
    init: (...args: unknown[]): Promise<unknown> =>
      mockSignClientInit(...args) as Promise<unknown>,
  },
  SESSION_CONTEXT: 'session',
}));

jest.mock('@reown/walletkit', () => ({
  WalletKit: {
    init: (...args: unknown[]): Promise<unknown> =>
      mockWalletKitInit(...args) as Promise<unknown>,
  },
}));

describe('walletConnectClient', () => {
  it('shares in-flight dapp client initialization', async () => {
    const core = { name: 'core' };
    const client = { name: 'sign-client' };
    mockCoreInit.mockResolvedValue(core);
    mockSignClientInit.mockResolvedValue(client);

    const walletConnectClient = (await import('./walletConnectClient')).default;
    const [firstClient, secondClient] = await Promise.all([
      walletConnectClient.getDappSideClient(),
      walletConnectClient.getDappSideClient(),
    ]);

    expect(firstClient).toBe(client);
    expect(secondClient).toBe(client);
    expect(mockCoreInit).toHaveBeenCalledTimes(1);
    expect(mockSignClientInit).toHaveBeenCalledTimes(1);
  });
});
