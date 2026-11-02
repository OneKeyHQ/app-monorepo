export const SIMPLE_DB_SNAPSHOT_CACHE_ENTITY_NAMES = [
  'localTokens',
  'accountValue',
  'deFi',
  'LocalNFTs',
  'perp',
  'earnData',
  'earnExtraData',
  'feeInfo',
  'ServerNetwork',
  'allNetworks',
  'chainResource',
  'aggregateToken',
  'privacyChainCache',
  'addressRiskCheck',
  'addressInfo',
  'riskyTokens',
  'riskTokenManagement',
  'approval',
  'transferRecipientsCache',
  'ipTable',
  'walletBanner',
  'universalSearch',
  'swapNetworksSort',
  'recentNetworks',
  'browserHistory',
  'browserCloseTabs',
] as const;

export type ISimpleDbSnapshotCacheEntityName =
  (typeof SIMPLE_DB_SNAPSHOT_CACHE_ENTITY_NAMES)[number];

const SIMPLE_DB_SNAPSHOT_CACHE_ENTITY_SET = new Set<string>(
  SIMPLE_DB_SNAPSHOT_CACHE_ENTITY_NAMES,
);

const SIMPLE_DB_KEY_PREFIX = 'simple_db_v5:';
const APP_SIMPLE_DB_KEY_PREFIX = 'app:simple_db_v5:';

export function isSimpleDbSnapshotCacheEntityName(
  entityName: string,
): entityName is ISimpleDbSnapshotCacheEntityName {
  return SIMPLE_DB_SNAPSHOT_CACHE_ENTITY_SET.has(entityName);
}

export function isSimpleDbSnapshotCacheKey(key: string): boolean {
  if (key.startsWith(SIMPLE_DB_KEY_PREFIX)) {
    return isSimpleDbSnapshotCacheEntityName(
      key.slice(SIMPLE_DB_KEY_PREFIX.length),
    );
  }
  if (key.startsWith(APP_SIMPLE_DB_KEY_PREFIX)) {
    return isSimpleDbSnapshotCacheEntityName(
      key.slice(APP_SIMPLE_DB_KEY_PREFIX.length),
    );
  }
  return false;
}
