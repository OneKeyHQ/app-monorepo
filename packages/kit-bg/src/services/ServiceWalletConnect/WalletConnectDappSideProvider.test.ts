import { OneKeyWalletConnectModalCloseError } from '@onekeyhq/shared/src/errors';
import type { IWalletConnectSignClient } from '@onekeyhq/shared/src/walletConnect/types';

import {
  type IWalletConnectDappProviderOpts,
  WalletConnectDappSideProvider,
} from './WalletConnectDappSideProvider';

const mockSuperConnect = jest.fn();
const mockSuperCleanup = jest.fn().mockResolvedValue(undefined);
const mockRegisteredClientListener = jest.fn();
const mockProviderEventsRemoveAllListeners = jest.fn();

jest.mock('@reown/appkit-core-react-native', () => ({
  StorageUtil: {},
}));

jest.mock('@walletconnect/universal-provider', () => ({
  __esModule: true,
  default: class UniversalProvider {
    constructor(opts: unknown) {
      const providerOpts = opts as { client?: unknown };
      Object.assign(this, {
        providerOpts: opts,
        client: providerOpts.client,
        events: {
          removeAllListeners: mockProviderEventsRemoveAllListeners,
        },
        logger: { trace: jest.fn() },
      });
    }

    connect(opts: unknown): Promise<unknown> {
      return mockSuperConnect(opts) as Promise<unknown>;
    }

    cleanup(): Promise<void> {
      return mockSuperCleanup() as Promise<void>;
    }

    getFromStore() {
      return Promise.resolve(undefined);
    }

    createProviders() {}

    registerEventListeners() {
      const provider = this as unknown as {
        client: {
          on: (
            event: string,
            listener: (...args: unknown[]) => unknown,
          ) => void;
        };
      };
      provider.client.on('session_ping', mockRegisteredClientListener);
    }
  },
}));

describe('WalletConnectDappSideProvider.abortConnectPairing', () => {
  beforeEach(() => {
    mockSuperConnect.mockReset();
    mockSuperCleanup.mockClear();
    mockRegisteredClientListener.mockClear();
    mockProviderEventsRemoveAllListeners.mockClear();
  });

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

  it('disconnects a session that settles after cancellation', async () => {
    let resolveConnect: ((session: { topic: string }) => void) | undefined;
    mockSuperConnect.mockImplementationOnce(
      () =>
        new Promise<{ topic: string }>((resolve) => {
          resolveConnect = resolve;
        }),
    );
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const client = {
      session: {
        keys: ['session-topic'],
      },
      disconnect,
      proposal: { getAll: () => [] },
      core: {
        pairing: {
          pairings: { keys: [] },
          disconnect: jest.fn(),
        },
      },
    } as unknown as IWalletConnectSignClient;
    const provider = new WalletConnectDappSideProvider({
      client,
      sessionTopic: undefined,
      backgroundApi: {},
    } as unknown as IWalletConnectDappProviderOpts);
    provider.uri = `wc:pairing-topic@2?relay-protocol=irn&symKey=${'1'.repeat(64)}`;

    const connect = provider.connect({ optionalNamespaces: {} });
    await provider.abortConnectPairing();
    await expect(connect).rejects.toBeInstanceOf(
      OneKeyWalletConnectModalCloseError,
    );

    resolveConnect?.({ topic: 'session-topic' });
    await Promise.resolve();
    await Promise.resolve();

    expect(disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'session-topic' }),
    );
  });

  it('removes the shared client listeners when disposed', async () => {
    const client = {
      session: { length: 0, keys: [] },
    } as unknown as IWalletConnectSignClient;
    const on = jest.fn(() => client);
    const off = jest.fn(() => client);
    Object.assign(client, { on, off });

    const provider = await WalletConnectDappSideProvider.initPro({
      client,
      sessionTopic: undefined,
      backgroundApi: {},
    } as unknown as IWalletConnectDappProviderOpts);

    expect(on).toHaveBeenCalledWith(
      'session_ping',
      mockRegisteredClientListener,
    );
    provider.dispose();
    provider.dispose();

    expect(off).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledWith(
      'session_ping',
      mockRegisteredClientListener,
    );
    expect(mockProviderEventsRemoveAllListeners).toHaveBeenCalledTimes(1);
  });
});
