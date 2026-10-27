import type { Core } from '@walletconnect/core';

type ITestCore = InstanceType<typeof Core>;

const originalGlobalCoreSetting = process.env.DISABLE_GLOBAL_CORE;

beforeEach(() => {
  jest.resetModules();
  process.env.DISABLE_GLOBAL_CORE = 'true';
});

afterEach(() => {
  jest.restoreAllMocks();
  if (originalGlobalCoreSetting === undefined)
    delete process.env.DISABLE_GLOBAL_CORE;
  else process.env.DISABLE_GLOBAL_CORE = originalGlobalCoreSetting;
});

it.each(['wallet', 'dapp'] as const)(
  'reuses the %s Core when client initialization fails after Core.start',
  async (side) => {
    const { Core: CoreClass } = await import('@walletconnect/core');
    const { WalletKit } = await import('@reown/walletkit');
    const { default: SignClient } = await import('@walletconnect/sign-client');
    const { walletConnectDiagnostics } =
      await import('./WalletConnectDiagnostics');
    const { default: clients } = await import('./walletConnectClient');
    const cores = new Set<ITestCore>();
    jest
      .spyOn(CoreClass.prototype, 'start')
      .mockImplementation(async function start(this: ITestCore) {
        cores.add(this);
        jest
          .spyOn(this.crypto, 'getClientId')
          .mockResolvedValue('test-client-id');
        jest.spyOn(this.storage, 'setItem').mockResolvedValue();
      });
    jest
      .spyOn(walletConnectDiagnostics, 'attachWallet')
      .mockImplementation(() => {});
    const error = new Error('client initialization failed');
    const walletInit = jest
      .spyOn(WalletKit, 'init')
      .mockRejectedValueOnce(error)
      .mockImplementation(async (options) => new WalletKit(options));
    const signInit = jest
      .spyOn(SignClient, 'init')
      .mockRejectedValueOnce(error)
      .mockImplementation(async (options) => new SignClient(options));
    const getClient =
      side === 'wallet'
        ? clients.getWalletSideClient
        : clients.getDappSideClient;
    const failed = await Promise.allSettled([getClient(), getClient()]);
    expect(failed).toEqual([
      { status: 'rejected', reason: error },
      { status: 'rejected', reason: error },
    ]);
    const [first, second] = await Promise.all([getClient(), getClient()]);
    expect(first).toBe(second);
    expect(cores.size).toBe(1);
    expect(first.core).toBe([...cores][0]);
    expect(side === 'wallet' ? walletInit : signInit).toHaveBeenCalledTimes(2);
  },
);

it('retains the same Core after a partial Core.start failure', async () => {
  const { Core: CoreClass } = await import('@walletconnect/core');
  const { default: SignClient } = await import('@walletconnect/sign-client');
  const { default: clients } = await import('./walletConnectClient');
  const cores = new Set<ITestCore>();
  const error = new Error('partial Core initialization failed');
  let attempts = 0;
  jest
    .spyOn(CoreClass.prototype, 'start')
    .mockImplementation(async function start(this: ITestCore) {
      cores.add(this);
      attempts += 1;
      if (attempts === 1) throw error;
      jest
        .spyOn(this.crypto, 'getClientId')
        .mockResolvedValue('test-client-id');
      jest.spyOn(this.storage, 'setItem').mockResolvedValue();
    });
  jest
    .spyOn(SignClient, 'init')
    .mockImplementation(async (options) => new SignClient(options));
  await expect(clients.getDappSideClient()).rejects.toBe(error);
  const client = await clients.getDappSideClient();
  expect(cores.size).toBe(1);
  expect(client.core).toBe([...cores][0]);
});
