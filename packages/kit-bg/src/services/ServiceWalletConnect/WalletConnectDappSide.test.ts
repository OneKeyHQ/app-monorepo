import { OneKeyWalletConnectModalCloseError } from '@onekeyhq/shared/src/errors';
import type {
  IWalletConnectConnectToWalletParams,
  IWalletConnectSignClient,
} from '@onekeyhq/shared/src/walletConnect/types';

import walletConnectClient from './walletConnectClient';
import { WalletConnectDappSide } from './WalletConnectDappSide';

import type { WalletConnectDappSideProvider } from './WalletConnectDappSideProvider';

jest.mock('react-native', () => ({
  Linking: {},
  Platform: { OS: 'ios' },
}));
jest.mock('../../connectors/externalWalletFactory', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./walletConnectClient', () => ({
  __esModule: true,
  default: {
    getDappSideClient: jest.fn(),
  },
}));
jest.mock('./WalletConnectDappSideProvider', () => ({
  WalletConnectDappSideProvider: class WalletConnectDappSideProvider {},
}));

type ITestConnectAttempt = {
  cancelled: boolean;
  provider?: WalletConnectDappSideProvider;
};

type ITestWalletConnectDappSide = {
  activeConnectAttempt?: ITestConnectAttempt;
  abortConnectPairing: (params: { uri?: string }) => Promise<void>;
  closeModal: jest.Mock<void, []>;
  connectToWallet: (
    params: IWalletConnectConnectToWalletParams,
  ) => Promise<unknown>;
  connectToWalletInternal: jest.Mock<
    Promise<void>,
    [IWalletConnectConnectToWalletParams, ITestConnectAttempt]
  >;
  openModal: jest.Mock<void, [{ uri: string }]>;
  openModalForConnectAttempt: (params: {
    attempt: ITestConnectAttempt;
    uri: string;
  }) => void;
};

type ITestCleanupWalletConnectDappSide = {
  cleanupPreviousWalletConnectAccounts: (
    attempt: ITestConnectAttempt,
  ) => Promise<void>;
};

function createDappSide() {
  return Object.assign(Object.create(WalletConnectDappSide.prototype), {
    closeModal: jest.fn(),
    connectToWalletInternal: jest.fn(),
    openModal: jest.fn(),
  }) as unknown as ITestWalletConnectDappSide;
}

describe('WalletConnectDappSide connection attempts', () => {
  beforeEach(() => {
    jest.mocked(walletConnectClient.getDappSideClient).mockReset();
  });

  it('reuses the in-flight shared client initialization', async () => {
    let resolveClient: ((client: IWalletConnectSignClient) => void) | undefined;
    const clientPromise = new Promise<IWalletConnectSignClient>((resolve) => {
      resolveClient = resolve;
    });
    jest
      .mocked(walletConnectClient.getDappSideClient)
      .mockReturnValue(clientPromise);
    const client = {
      on: jest.fn(),
    } as unknown as IWalletConnectSignClient;
    const dappSide = new WalletConnectDappSide({ backgroundApi: {} });

    const firstClient = dappSide.getSharedClient();
    const secondClient = dappSide.getSharedClient();

    expect(walletConnectClient.getDappSideClient).toHaveBeenCalledTimes(1);
    resolveClient?.(client);
    await expect(firstClient).resolves.toBe(client);
    await expect(secondClient).resolves.toBe(client);
    expect(client.on).toHaveBeenCalledTimes(3);
  });

  it('stops a cancelled attempt before removing queried accounts', async () => {
    let resolveAccounts:
      | ((value: { accounts: Array<{ id: string }> }) => void)
      | undefined;
    const getWalletConnectDBAccounts = jest.fn(
      () =>
        new Promise<{ accounts: Array<{ id: string }> }>((resolve) => {
          resolveAccounts = resolve;
        }),
    );
    const removeAccount = jest.fn().mockResolvedValue(undefined);
    const dappSide = new WalletConnectDappSide({
      backgroundApi: {
        serviceAccount: {
          getWalletConnectDBAccounts,
          removeAccount,
        },
      },
    }) as unknown as ITestCleanupWalletConnectDappSide;
    const attempt: ITestConnectAttempt = { cancelled: false };

    const cleanup = dappSide.cleanupPreviousWalletConnectAccounts(attempt);
    await Promise.resolve();
    attempt.cancelled = true;
    resolveAccounts?.({ accounts: [{ id: 'wallet-connect-account' }] });

    await expect(cleanup).rejects.toBeInstanceOf(
      OneKeyWalletConnectModalCloseError,
    );
    expect(removeAccount).not.toHaveBeenCalled();
  });

  it('does not let a stale URI cancel an attempt before its URI is ready', async () => {
    const dappSide = createDappSide();
    const abortConnectPairing = jest.fn().mockResolvedValue(undefined);
    const attempt: ITestConnectAttempt = {
      cancelled: false,
      provider: {
        uri: undefined,
        abortConnectPairing,
      } as unknown as WalletConnectDappSideProvider,
    };
    dappSide.activeConnectAttempt = attempt;

    await dappSide.abortConnectPairing({ uri: 'wc:stale' });

    expect(attempt.cancelled).toBe(false);
    expect(abortConnectPairing).not.toHaveBeenCalled();
  });

  it('only lets the active attempt close the modal', async () => {
    const dappSide = createDappSide();
    const resolvers: Array<() => void> = [];
    dappSide.connectToWalletInternal.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const firstConnect = dappSide.connectToWallet({ impl: 'first' });
    await Promise.resolve();
    const secondConnect = dappSide.connectToWallet({ impl: 'second' });
    await Promise.resolve();

    resolvers[0]?.();
    await firstConnect;
    expect(dappSide.closeModal).not.toHaveBeenCalled();

    resolvers[1]?.();
    await secondConnect;
    expect(dappSide.closeModal).toHaveBeenCalledTimes(1);
  });

  it('only lets the active attempt open the modal', () => {
    const dappSide = createDappSide();
    const staleAttempt: ITestConnectAttempt = { cancelled: true };
    const supersededAttempt: ITestConnectAttempt = { cancelled: false };
    const activeAttempt: ITestConnectAttempt = { cancelled: false };
    dappSide.activeConnectAttempt = activeAttempt;

    dappSide.openModalForConnectAttempt({
      attempt: staleAttempt,
      uri: 'wc:stale',
    });
    expect(dappSide.openModal).not.toHaveBeenCalled();

    dappSide.openModalForConnectAttempt({
      attempt: supersededAttempt,
      uri: 'wc:superseded',
    });
    expect(dappSide.openModal).not.toHaveBeenCalled();

    dappSide.openModalForConnectAttempt({
      attempt: activeAttempt,
      uri: 'wc:active',
    });
    expect(dappSide.openModal).toHaveBeenCalledWith({ uri: 'wc:active' });
  });
});
