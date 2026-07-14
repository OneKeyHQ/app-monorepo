import logger from 'electron-log/main';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  NobleLike,
  NoblePeripheralLike,
} from '@onekeyfe/hwk-trezor-connector-electron-ble/main';

// A thin proxy around noble, injected into the SDK via its public `nobleFactory`
// option. It exists to solve one problem:
//
// The SDK caches discovered peripherals and evicts them aggressively — the whole
// cache is cleared 10s after the last scan call, and individual entries are
// pruned after 5s without an advertisement. OS pairing takes 8-22s, and a Safe 7
// STOPS ADVERTISING once bonded (it holds the link and waits for the host). So by
// the time `connect` runs, its peripheral is gone from the cache and cannot be
// rediscovered: "Trezor BLE device not found".
//
// The peripheral OBJECT is still perfectly valid though — a retry works purely
// because the cache happened to survive. So we keep the last real peripheral noble
// gave us per id and can replay its `discover` event on demand, which puts it
// straight back into the SDK's cache (that handler is a plain
// `_discovered.set(id, p); _lastSeen.set(id, now)`).
//
// Nothing here is Windows-specific, but nothing here fires unless someone calls
// `replayDiscover`, so other platforms are unaffected.

type IDiscoverHandler = (peripheral: NoblePeripheralLike) => void;

let realNoble: NobleLike | undefined;
const lastPeripheralById = new Map<string, NoblePeripheralLike>();
const discoverHandlers = new Map<IDiscoverHandler, IDiscoverHandler>();

class TrezorNobleProxy implements NobleLike {
  get state(): string {
    return realNoble?.state ?? 'unknown';
  }

  on(event: string, handler: (...args: any[]) => void): NobleLike {
    if (event !== 'discover') {
      realNoble?.on(event, handler);
      return this;
    }
    // Remember every peripheral noble really discovered, then pass it through
    // untouched. This is the only place a genuine peripheral object exists.
    const wrapped: IDiscoverHandler = (peripheral) => {
      if (peripheral?.id) {
        lastPeripheralById.set(peripheral.id, peripheral);
      }
      handler(peripheral);
    };
    discoverHandlers.set(handler as IDiscoverHandler, wrapped);
    realNoble?.on(event, wrapped);
    return this;
  }

  removeListener(event: string, handler: (...args: any[]) => void): NobleLike {
    const wrapped = discoverHandlers.get(handler as IDiscoverHandler);
    if (event === 'discover' && wrapped) {
      discoverHandlers.delete(handler as IDiscoverHandler);
      realNoble?.removeListener(event, wrapped);
      return this;
    }
    realNoble?.removeListener(event, handler);
    return this;
  }

  async startScanningAsync(
    serviceUuids: string[],
    allowDuplicates: boolean,
  ): Promise<void> {
    await realNoble?.startScanningAsync(serviceUuids, allowDuplicates);
  }

  async stopScanningAsync(): Promise<void> {
    await realNoble?.stopScanningAsync();
  }

  async reset(): Promise<void> {
    await realNoble?.reset?.();
  }
}

const proxy = new TrezorNobleProxy();

export function createTrezorNobleFactory(): () => NobleLike {
  return () => {
    if (!realNoble) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      realNoble = require('@stoprocent/noble') as NobleLike;
      logger.info('[TrezorBLE] noble proxy installed');
    }
    return proxy;
  };
}

/**
 * Re-emit the last real `discover` event for `id`, putting the peripheral back
 * into the SDK's cache without needing the device to advertise again.
 * Returns false when we never saw the device (nothing to replay).
 */
export function replayDiscover(id: string): boolean {
  const peripheral = lastPeripheralById.get(id);
  if (!peripheral) {
    logger.warn(
      `[TrezorBLE] replayDiscover(${id}): no cached peripheral; known=[${[
        ...lastPeripheralById.keys(),
      ].join(',')}]`,
    );
    return false;
  }
  logger.info(
    `[TrezorBLE] replayDiscover(${id}): re-emitting to ${discoverHandlers.size} handler(s), peripheral.state=${String(
      (peripheral as { state?: string }).state,
    )}`,
  );
  for (const wrapped of discoverHandlers.values()) {
    try {
      wrapped(peripheral);
    } catch (error) {
      logger.warn(
        `[TrezorBLE] replayDiscover handler threw: ${
          error instanceof Error ? error.message : ''
        }`,
      );
    }
  }
  return true;
}

/**
 * Ask noble to connect by address with no scan at all. The Windows backend
 * supports this explicitly (ble_manager.cc `Connect`: when the address is not in
 * its device map it synthesizes a peripheral "as if it was scanned" and emits the
 * scan event). Kept as an alternative to `replayDiscover` — selectable at runtime
 * because it also opens the link itself, which `replayDiscover` leaves to the SDK.
 */
export async function directConnect(id: string): Promise<void> {
  const noble = realNoble as
    | (NobleLike & { connectAsync?: (id: string) => Promise<unknown> })
    | undefined;
  if (!noble?.connectAsync) {
    throw new OneKeyLocalError('noble.connectAsync is unavailable');
  }
  logger.info(`[TrezorBLE] directConnect(${id}) — no scan, connect by address`);
  await noble.connectAsync(id);
}
