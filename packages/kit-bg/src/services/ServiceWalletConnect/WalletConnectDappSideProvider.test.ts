import { OneKeyWalletConnectModalCloseError } from '@onekeyhq/shared/src/errors';

import { WalletConnectDappSideProvider } from './WalletConnectDappSideProvider';

jest.mock('@reown/appkit-core-react-native', () => ({
  StorageUtil: {},
}));

jest.mock('@walletconnect/universal-provider', () => ({
  __esModule: true,
  default: class UniversalProvider {},
}));

describe('WalletConnectDappSideProvider.abortConnectPairing', () => {
  it('rejects the pending connect and targets the matching session event', async () => {
    const rejectPendingConnect = jest.fn();
    const emit = jest.fn();
    const setExpiry = jest.fn();
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const provider = Object.assign(
      Object.create(WalletConnectDappSideProvider.prototype),
      {
        uri: `wc:pairing-topic@2?relay-protocol=irn&symKey=${'1'.repeat(64)}`,
        rejectPendingConnect,
        client: {
          proposal: {
            getAll: () => [
              {
                id: 123,
                pairingTopic: 'pairing-topic',
              },
            ],
          },
          engine: { events: { emit } },
          core: {
            expirer: { set: setExpiry },
            pairing: {
              pairings: { keys: ['pairing-topic'] },
              disconnect,
            },
          },
        },
      },
    ) as WalletConnectDappSideProvider;

    await provider.abortConnectPairing();

    expect(rejectPendingConnect).toHaveBeenCalledWith(
      expect.any(OneKeyWalletConnectModalCloseError),
    );
    expect(emit).toHaveBeenCalledWith(
      'session_connect:123',
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'OneKeyWalletConnectModalCloseError',
        }),
      }),
    );
    expect(setExpiry).toHaveBeenCalledWith(123, 0);
    expect(disconnect).toHaveBeenCalledWith({ topic: 'pairing-topic' });
    expect(provider.uri).toBeUndefined();
  });

  it('waits for display_uri when cancellation happens before pairing creation', async () => {
    const rejectPendingConnect = jest.fn();
    const once = jest.fn();
    const provider = Object.assign(
      Object.create(WalletConnectDappSideProvider.prototype),
      {
        uri: undefined,
        rejectPendingConnect,
        once,
      },
    ) as WalletConnectDappSideProvider;

    await provider.abortConnectPairing();

    expect(rejectPendingConnect).toHaveBeenCalledWith(
      expect.any(OneKeyWalletConnectModalCloseError),
    );
    expect(once).toHaveBeenCalledWith('display_uri', expect.any(Function));
  });
});
