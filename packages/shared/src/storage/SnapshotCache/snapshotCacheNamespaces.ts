import { swrCacheNamespaces } from '../../utils/swrCacheNamespaceNames';

/**
 * Every UI snapshot namespace the app can hold.
 *
 * The list exists because two callers need the whole set before the modules
 * that use them have necessarily been imported: the app's own "clear data",
 * which must leave nothing behind, and the idle sweep that reclaims expired
 * records. A namespace missing here would be invisible to both.
 *
 * Physical names are lowercase and hyphenated because that is what a store
 * name may contain on either platform.
 */
function toNamespaceName(camelCase: string) {
  return camelCase.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** The namespace an SWR key's leading segment maps to. */
export function swrCacheNamespaceName(swrNamespace: string) {
  return `swr-${toNamespaceName(swrNamespace)}` as ISnapshotCacheNamespace;
}

/** Keys whose leading segment names no known namespace share this one. */
export const SWR_CACHE_FALLBACK_NAMESPACE = 'swr-other';

/** Namespaces declared by a feature rather than derived from an SWR key. */
export const FEATURE_SNAPSHOT_CACHE_NAMESPACES = [
  'market-token-detail',
  'ctx-atom-snapshot',
  'account-selector',
  'tokenlist-maintenance',
  'tokenlist-owner-slim',
  'tokenlist-owner-worth',
  'home-header-layout',
] as const;

export type ISnapshotCacheNamespace =
  | (typeof FEATURE_SNAPSHOT_CACHE_NAMESPACES)[number]
  | `swr-${string}`;

export const SNAPSHOT_CACHE_NAMESPACES: readonly ISnapshotCacheNamespace[] = [
  ...FEATURE_SNAPSHOT_CACHE_NAMESPACES,
  SWR_CACHE_FALLBACK_NAMESPACE,
  ...Object.values(swrCacheNamespaces).map(swrCacheNamespaceName),
];
