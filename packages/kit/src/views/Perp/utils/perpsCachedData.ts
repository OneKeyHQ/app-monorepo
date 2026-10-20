import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';

export async function loadPerpsCachedData<T>(
  swrKey: string | undefined,
  load: () => Promise<T>,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    const cached = swrKey ? swrCacheUtils.get<T>(swrKey) : undefined;
    if (cached !== undefined) return cached;
    throw error;
  }
}
