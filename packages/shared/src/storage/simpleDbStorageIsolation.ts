const SIMPLE_DB_KEY_PREFIX = 'simple_db_v5:';
const APP_SIMPLE_DB_KEY_PREFIX = 'app:simple_db_v5:';
const ISOLATED_SIMPLE_DB_MMKV_PREFIX = 'onekey-simple-db-';

/**
 * Pure-cache historical SimpleDb entities that have been moved out of
 * `onekey-app-storage-v1` into sharded `SnapshotCache` files
 * (`onekey-display-snapshot-sdb-*`).
 */
export const SHARDED_SNAPSHOT_SIMPLE_DB_ENTITY_NAMES = [
  'accountValue',
  'LocalNFTs',
  'localTokens',
] as const;

/**
 * Mixed historical SimpleDb entities whose persistent preference/config fields
 * remain in `onekey-app-storage-v1` while their high-frequency/large cache
 * fields are split into sharded `SnapshotCache` files.
 */
export const MIXED_SPLIT_SIMPLE_DB_ENTITY_NAMES = [
  'aggregateToken',
  'deFi',
  'perp',
] as const;

/**
 * Frozen historical whitelist of `SimpleDbEntity` names allowed to read/write
 * their single-key record (`simple_db_v5:<entityName>`) in the shared
 * `onekey-app-storage-v1` MMKV instance.
 *
 * Do NOT add new entities to this list. Any new `SimpleDbEntity` (or any
 * sub-keyed record `simple_db_v5:<entityName>:<subKey>`) is automatically
 * routed to its own isolated MMKV file (`onekey-simple-db-<entityName>`) so
 * entities never amplify each other's MMKV full-write-backs.
 */
export const LEGACY_APP_STORAGE_ENTITY_NAMES = [
  'accountSelector',
  'addressBookItems',
  'addressInfo',
  'addressRiskCheck',
  'aggregateToken',
  'allNetworks',
  'appCleanup',
  'approval',
  'appStatus',
  'babylonSync',
  'botWallet',
  'broadcastRecords',
  'browserBookmarks',
  'browserCloseTabs',
  'browserHistory',
  'browserRiskWhilteList',
  'browserTabs',
  'btcFreshAddress',
  'btcFreshAddressMeta',
  'chainResource',
  'changeHistory',
  'cloudBackupPasswordCache',
  'cloudSyncAccountIssues',
  'customNetwork',
  'customRpc',
  'customTokens',
  'dappConnection',
  'defaultWalletSettings',
  'deFi',
  'earnData',
  'earnExtraData',
  'earnOrders',
  'feeInfo',
  'firmwareArtifactCache',
  'floatingIconDomainBlockList',
  'floatingIconSettings',
  'hardwarePortfolioSync',
  'hardwareTelemetry',
  'headlessBuyOrders',
  'ipTable',
  'legacyWalletNames',
  'lightning',
  'localHistory',
  'marketListingWatchList',
  'marketPresetSettings',
  'marketTokenPreference',
  'marketWatchList',
  'marketWatchListV2',
  'networkSelector',
  'notificationSettings',
  'perp',
  'prime',
  'primeFreeTrial',
  'primeTransfer',
  'privacyChainCache',
  'privacyChainJournal',
  'privacyChainKeys',
  'privacyChainState',
  'privacyChainXmrSent',
  'privacyChainZcashSent',
  'receiveArrivalConfig',
  'recentNetworks',
  'recentRecipients',
  'ReferralCode',
  'riskTokenManagement',
  'riskyTokens',
  'rookieGuide',
  'ServerNetwork',
  'swapConfigs',
  'swapHistory',
  'swapNetworksSort',
  'swapProSelectToken',
  'transferRecipientsCache',
  'universalSearch',
  'v4MigrationResult',
  'walletBanner',
  'walletConnectPay',
  'walletStatus',
] as const;

export type ILegacyAppStorageEntityName =
  (typeof LEGACY_APP_STORAGE_ENTITY_NAMES)[number];

const LEGACY_APP_STORAGE_ENTITY_SET = new Set<string>(
  LEGACY_APP_STORAGE_ENTITY_NAMES,
);

const SHARDED_SNAPSHOT_SIMPLE_DB_ENTITY_SET = new Set<string>(
  SHARDED_SNAPSHOT_SIMPLE_DB_ENTITY_NAMES,
);

export function isLegacyAppStorageEntityName(
  entityName: string,
): entityName is ILegacyAppStorageEntityName {
  return LEGACY_APP_STORAGE_ENTITY_SET.has(entityName);
}

export function isShardedSnapshotSimpleDbEntityName(
  entityName: string,
): boolean {
  return SHARDED_SNAPSHOT_SIMPLE_DB_ENTITY_SET.has(entityName);
}

function toKebabSegment(entityName: string): string {
  const normalized = entityName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return normalized || 'entity';
}

export function getIsolatedSimpleDbMMKVId(entityName: string): string {
  return `${ISOLATED_SIMPLE_DB_MMKV_PREFIX}${toKebabSegment(entityName)}`;
}

export function parseSimpleDbStorageKey(rawKey: string):
  | {
      entityName: string;
      subKey: string | undefined;
    }
  | undefined {
  let remainder: string | undefined;
  if (rawKey.startsWith(SIMPLE_DB_KEY_PREFIX)) {
    remainder = rawKey.slice(SIMPLE_DB_KEY_PREFIX.length);
  } else if (rawKey.startsWith(APP_SIMPLE_DB_KEY_PREFIX)) {
    remainder = rawKey.slice(APP_SIMPLE_DB_KEY_PREFIX.length);
  }
  if (!remainder) {
    return undefined;
  }
  const separatorIndex = remainder.indexOf(':');
  if (separatorIndex === -1) {
    return {
      entityName: remainder,
      subKey: undefined,
    };
  }
  const entityName = remainder.slice(0, separatorIndex);
  if (!entityName) {
    return undefined;
  }
  return {
    entityName,
    subKey: remainder.slice(separatorIndex + 1),
  };
}

export function resolveSimpleDbStorageTarget(rawKey: string):
  | {
      isolated: false;
    }
  | {
      isolated: true;
      entityName: string;
      mmkvId: string;
      subKey: string | undefined;
    } {
  const parsed = parseSimpleDbStorageKey(rawKey);
  if (!parsed) {
    return { isolated: false };
  }
  // Only exact single-key records of frozen historical entities stay in the
  // shared `onekey-app-storage-v1` file. Any newly added SimpleDbEntity or any
  // key-sharded record (`simple_db_v5:<entityName>:<subKey>`) gets its own
  // isolated MMKV file per entity.
  if (
    parsed.subKey === undefined &&
    isLegacyAppStorageEntityName(parsed.entityName)
  ) {
    return { isolated: false };
  }
  return {
    isolated: true,
    entityName: parsed.entityName,
    mmkvId: getIsolatedSimpleDbMMKVId(parsed.entityName),
    subKey: parsed.subKey,
  };
}
