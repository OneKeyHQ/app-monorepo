import type { IWalletConnectConnectToWalletParams } from '@onekeyhq/shared/src/walletConnect/types';

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
  default: {},
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

function createDappSide() {
  return Object.assign(Object.create(WalletConnectDappSide.prototype), {
    closeModal: jest.fn(),
    connectToWalletInternal: jest.fn(),
    openModal: jest.fn(),
  }) as unknown as ITestWalletConnectDappSide;
}

describe('WalletConnectDappSide connection attempts', () => {
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
