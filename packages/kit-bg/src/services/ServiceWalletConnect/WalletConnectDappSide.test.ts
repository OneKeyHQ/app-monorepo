import { EventEmitter } from 'events';

import type { IWalletConnectSignClient } from '@onekeyhq/shared/src/walletConnect/types';

import walletConnectClient from './walletConnectClient';
import { WalletConnectDappSide } from './WalletConnectDappSide';

jest.mock('./walletConnectClient', () => ({
  __esModule: true,
  default: { getDappSideClient: jest.fn() },
}));
jest.mock('../../connectors/externalWalletFactory', () => ({}));
jest.mock('../../dbs/local/localDb', () => ({}));
jest.mock('./WalletConnectDappSideProvider', () => ({
  WalletConnectDappSideProvider: jest.fn(),
}));

it('registers one set of session handlers for concurrent cold-start callers', async () => {
  const events = new EventEmitter();
  // Only the session event interface is exercised here.
  const client = events as unknown as IWalletConnectSignClient;
  jest.mocked(walletConnectClient.getDappSideClient).mockResolvedValue(client);
  const dapp = new WalletConnectDappSide({ backgroundApi: {} });
  const update = jest
    .spyOn(dapp, 'updateAccountByNamespaces')
    .mockResolvedValue();
  const event = jest.spyOn(dapp, 'updateAccountByEvents').mockResolvedValue();
  const remove = jest.spyOn(dapp, 'removeAccount').mockResolvedValue();
  const disconnect = jest.spyOn(dapp, 'disconnectProvider').mockResolvedValue();

  expect(
    await Promise.all([dapp.getSharedClient(), dapp.getSharedClient()]),
  ).toEqual([client, client]);
  await dapp.getSharedClient();
  for (const name of ['session_update', 'session_event', 'session_delete']) {
    const listeners = events.listeners(name) as Array<
      (args: unknown) => Promise<void>
    >;
    await Promise.all(
      listeners.map((listener) =>
        listener({ topic: 'test-topic', params: { namespaces: {} } }),
      ),
    );
  }
  expect(update).toHaveBeenCalledTimes(1);
  expect(event).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
});

it('allows shared client initialization to retry after failure', async () => {
  const error = new Error('client initialization failed');
  const events = new EventEmitter();
  const client = events as unknown as IWalletConnectSignClient;
  jest
    .mocked(walletConnectClient.getDappSideClient)
    .mockRejectedValueOnce(error)
    .mockResolvedValue(client);
  const dapp = new WalletConnectDappSide({ backgroundApi: {} });
  await expect(dapp.getSharedClient()).rejects.toBe(error);
  await expect(dapp.getSharedClient()).resolves.toBe(client);
  expect(events.listenerCount('session_update')).toBe(1);
});
