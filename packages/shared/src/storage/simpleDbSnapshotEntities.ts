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

export type ISimpleDbSnapshotNamespace = `sdb-${string}`;

function toKebabNamespaceSegment(entityName: string): string {
  return entityName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

export function simpleDbSnapshotNamespaceName(
  entityName: string,
): ISimpleDbSnapshotNamespace {
  return `sdb-${toKebabNamespaceSegment(entityName)}`;
}

export function isSimpleDbSnapshotCacheEntityName(
  entityName: string,
): entityName is ISimpleDbSnapshotCacheEntityName {
  return SIMPLE_DB_SNAPSHOT_CACHE_ENTITY_SET.has(entityName);
}

export function extractSimpleDbSnapshotEntityName(
  key: string,
): ISimpleDbSnapshotCacheEntityName | undefined {
  let candidate: string | undefined;
  if (key.startsWith(SIMPLE_DB_KEY_PREFIX)) {
    candidate = key.slice(SIMPLE_DB_KEY_PREFIX.length);
  } else if (key.startsWith(APP_SIMPLE_DB_KEY_PREFIX)) {
    candidate = key.slice(APP_SIMPLE_DB_KEY_PREFIX.length);
  }
  if (candidate && isSimpleDbSnapshotCacheEntityName(candidate)) {
    return candidate;
  }
  return undefined;
}

export function isSimpleDbSnapshotCacheKey(key: string): boolean {
  return extractSimpleDbSnapshotEntityName(key) !== undefined;
}
