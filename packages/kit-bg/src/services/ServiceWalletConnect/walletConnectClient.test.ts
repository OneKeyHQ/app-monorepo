const mockCoreInit = jest.fn(async ({ storage }) => ({ storage }));
const mockSignClientInit = jest.fn(async () => ({}));
const mockAppStorage = {
  getAllKeys: jest.fn().mockResolvedValue([]),
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

jest.mock('@walletconnect/core', () => ({
  Core: { init: mockCoreInit },
}));
jest.mock('@walletconnect/sign-client', () => ({
  __esModule: true,
  default: { init: mockSignClientInit },
  SESSION_CONTEXT: 'session',
}));
jest.mock('@reown/walletkit', () => ({
  WalletKit: { init: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: mockAppStorage,
}));

describe('walletConnectClient storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores WalletConnect data in OneKeyAppStorage instead of creating a separate IndexedDB', async () => {
    const { default: walletConnectClient } =
      await import('./walletConnectClient');

    await walletConnectClient.getDappSideClient();

    const storage = mockCoreInit.mock.calls[0][0].storage as {
      setItem: (key: string, value: unknown) => Promise<void>;
    };
    await storage.setItem('wc-key', { topic: 'topic-1' });
    expect(mockAppStorage.setItem).toHaveBeenCalledWith(
      'wallet_connect_v2:wc-key',
      JSON.stringify({ topic: 'topic-1' }),
    );
  });
});
