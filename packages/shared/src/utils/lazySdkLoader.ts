/**
 * Generic lazy SDK loader with singleton caching and inflight deduplication.
 *
 * Usage:
 *   const getEthers = createLazySdkLoader(() => import('ethers'));
 *   const { ethers } = await getEthers();
 */
export function createLazySdkLoader<T>(
  factory: () => Promise<T>,
): () => Promise<T> {
  let cached: T | null = null;
  let loading: Promise<T> | null = null;
  return () => {
    if (cached) return Promise.resolve(cached);
    if (!loading) {
      loading = factory().then(
        (mod) => {
          cached = mod;
          return mod;
        },
        (error) => {
          loading = null;
          throw error;
        },
      );
    }
    return loading;
  };
}
