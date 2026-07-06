import { primeCachedImageRefs } from '@onekeyhq/components/src/primitives/Image/cache';
import { preloadImages } from '@onekeyhq/components/src/primitives/Image/preload';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

type IMarketTokenImageSource = {
  tokenImageUri?: string;
  tokenImageUris?: string[];
};

const MARKET_TOKEN_IMAGE_PREWARM_LIMIT = 4;
const MARKET_TOKEN_IMAGE_DECODE_TIMEOUT_MS = 350;
const MAX_TRACKED_MARKET_TOKEN_IMAGE_URIS = 600;

const prewarmedMarketTokenImageUris = new Set<string>();
const prewarmingMarketTokenImageUris = new Set<string>();

function uniqueImageUris(uris: Array<string | undefined>) {
  return [...new Set(uris.filter((uri): uri is string => Boolean(uri)))];
}

function rememberPrewarmedUris(uris: string[]) {
  if (
    prewarmedMarketTokenImageUris.size > MAX_TRACKED_MARKET_TOKEN_IMAGE_URIS
  ) {
    prewarmedMarketTokenImageUris.clear();
  }
  uris.forEach((uri) => prewarmedMarketTokenImageUris.add(uri));
}

export function prewarmMarketTokenImages(
  source?: IMarketTokenImageSource,
  options?: {
    limit?: number;
  },
) {
  if (!source) return;

  const uris = uniqueImageUris([
    source.tokenImageUri,
    ...(source.tokenImageUris ?? []),
  ])
    .filter(
      (uri) =>
        !prewarmedMarketTokenImageUris.has(uri) &&
        !prewarmingMarketTokenImageUris.has(uri),
    )
    .slice(0, options?.limit ?? MARKET_TOKEN_IMAGE_PREWARM_LIMIT);

  if (uris.length === 0) return;

  uris.forEach((uri) => prewarmingMarketTokenImageUris.add(uri));

  void Promise.allSettled([
    preloadImages(uris.map((uri) => ({ uri }))),
    primeCachedImageRefs({
      uris,
      timeoutMs: MARKET_TOKEN_IMAGE_DECODE_TIMEOUT_MS,
    }),
  ])
    .then(([preloadResult]) => {
      if (preloadResult.status === 'fulfilled' && preloadResult.value) {
        rememberPrewarmedUris(uris);
      }
    })
    .finally(() => {
      uris.forEach((uri) => prewarmingMarketTokenImageUris.delete(uri));
    });
}

export function prewarmMarketTokenDetailPreviewImages(
  tokenDetailPreview?: IMarketTokenDetailPreview,
) {
  prewarmMarketTokenImages(tokenDetailPreview);
}
