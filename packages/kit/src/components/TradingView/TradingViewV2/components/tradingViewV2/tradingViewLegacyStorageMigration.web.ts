import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const MIGRATION_REQUEST_TYPE =
  'ONEKEY_TRADINGVIEW_LEGACY_STORAGE_MIGRATION_REQUEST';
const MIGRATION_RESPONSE_TYPE =
  'ONEKEY_TRADINGVIEW_LEGACY_STORAGE_MIGRATION_RESPONSE';
const MIGRATION_VERSION = 1;
const MIGRATION_TIMEOUT_MS = 5000;
const MAX_MIGRATION_ENTRY_COUNT = 2000;
const MAX_MIGRATION_TOTAL_SIZE = 4 * 1024 * 1024;
const MIGRATABLE_STORAGE_PREFIXES = [
  'tradingview_drawings_',
  'tradingview_study_template_',
  'tradingview_settings_',
  'tradingview_interval_',
  'tradingview_pane_heights_',
  'tradingview_default_volume_removed_',
] as const;
const TRUSTED_LEGACY_ORIGINS = new Set([
  new URL(TRADING_VIEW_URL).origin,
  new URL(TRADING_VIEW_URL_TEST).origin,
]);

interface ILegacyStorageMigrationResponse {
  entries?: unknown;
  requestId?: unknown;
  type?: unknown;
  version?: unknown;
}

let migrationPromise: Promise<void> | undefined;

function createRequestId(): string {
  const randomBytes = new Uint32Array(4);
  globalThis.crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (value) => value.toString(16)).join('');
}

function isMigratableStorageKey(key: string): boolean {
  return MIGRATABLE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function getMigrationMarkerKey(origin: string): string {
  return `onekey_tradingview_storage_migration_v${MIGRATION_VERSION}:${origin}`;
}

function getMigrationAttemptKey(origin: string): string {
  return `${getMigrationMarkerKey(origin)}:attempted`;
}

export function importLegacyTradingViewStorageEntries(entries: unknown): void {
  if (!Array.isArray(entries) || entries.length > MAX_MIGRATION_ENTRY_COUNT) {
    throw new OneKeyLocalError(
      'TradingView storage migration payload is invalid',
    );
  }

  let totalSize = 0;
  const validatedEntries = entries.map((entry) => {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'string' ||
      typeof entry[1] !== 'string' ||
      !isMigratableStorageKey(entry[0])
    ) {
      throw new OneKeyLocalError(
        'TradingView storage migration entry is invalid',
      );
    }
    totalSize += entry[0].length + entry[1].length;
    if (totalSize > MAX_MIGRATION_TOTAL_SIZE) {
      throw new OneKeyLocalError(
        'TradingView storage migration payload is too large',
      );
    }
    return entry as [string, string];
  });

  validatedEntries.forEach(([key, value]) => {
    if (globalThis.localStorage.getItem(key) === null) {
      globalThis.localStorage.setItem(key, value);
    }
  });
}

function requestLegacyTradingViewStorage(
  migrationUrl: URL,
  requestId: string,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    const channel = new MessageChannel();
    let settled = false;

    const cleanup = () => {
      channel.port1.close();
      channel.port2.close();
      iframe.remove();
    };
    const timeoutHandle = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new OneKeyLocalError('TradingView storage migration timed out'));
    }, MIGRATION_TIMEOUT_MS);
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      cleanup();
      callback();
    };

    channel.port1.onmessage = (
      event: MessageEvent<ILegacyStorageMigrationResponse>,
    ) => {
      const response = event.data;
      if (
        response?.type !== MIGRATION_RESPONSE_TYPE ||
        response.requestId !== requestId ||
        response.version !== MIGRATION_VERSION
      ) {
        return;
      }
      finish(() => resolve(response.entries));
    };
    channel.port1.start();

    iframe.hidden = true;
    iframe.tabIndex = -1;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.addEventListener(
      'load',
      () => {
        iframe.contentWindow?.postMessage(
          {
            requestId,
            type: MIGRATION_REQUEST_TYPE,
            version: MIGRATION_VERSION,
          },
          migrationUrl.origin,
          [channel.port2],
        );
      },
      { once: true },
    );
    iframe.src = migrationUrl.toString();
    document.body.appendChild(iframe);
  });
}

async function runLegacyTradingViewStorageMigration(
  runtimeUrl: string,
): Promise<void> {
  const migrationUrl = new URL(runtimeUrl, globalThis.location.href);
  if (
    migrationUrl.origin === globalThis.location.origin ||
    !TRUSTED_LEGACY_ORIGINS.has(migrationUrl.origin)
  ) {
    return;
  }

  const migrationMarkerKey = getMigrationMarkerKey(migrationUrl.origin);
  if (globalThis.localStorage.getItem(migrationMarkerKey) === '1') {
    return;
  }
  const migrationAttemptKey = getMigrationAttemptKey(migrationUrl.origin);
  if (globalThis.sessionStorage.getItem(migrationAttemptKey) === '1') {
    return;
  }
  globalThis.sessionStorage.setItem(migrationAttemptKey, '1');

  migrationUrl.hash = '';
  migrationUrl.search = '';
  migrationUrl.searchParams.set('storageMigration', String(MIGRATION_VERSION));
  const entries = await requestLegacyTradingViewStorage(
    migrationUrl,
    createRequestId(),
  );
  importLegacyTradingViewStorageEntries(entries);
  globalThis.localStorage.setItem(migrationMarkerKey, '1');
}

export function migrateLegacyTradingViewStorage(
  runtimeUrl: string,
): Promise<void> {
  migrationPromise ??= runLegacyTradingViewStorageMigration(runtimeUrl).catch(
    (error) => {
      migrationPromise = undefined;
      throw error;
    },
  );
  return migrationPromise;
}
