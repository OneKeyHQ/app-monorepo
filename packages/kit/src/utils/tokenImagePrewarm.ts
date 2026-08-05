import { primeCachedImageRefs } from '@onekeyhq/components/src/primitives/Image/cache';
import { preloadImages } from '@onekeyhq/components/src/primitives/Image/preload';

export type ITokenImagePrewarmSource = {
  tokenImageUri?: string;
  tokenImageUris?: string[];
};

const TOKEN_IMAGE_PREWARM_LIMIT = 4;
const TOKEN_IMAGE_DECODE_TIMEOUT_MS = 350;
const MAX_TRACKED_TOKEN_IMAGE_URIS = 600;

const prewarmedTokenImageUris = new Set<string>();
const prewarmingTokenImageUris = new Set<string>();

function uniqueImageUris(uris: Array<string | undefined>) {
  return [...new Set(uris.filter((uri): uri is string => Boolean(uri)))];
}

function rememberPrewarmedUris(uris: string[]) {
  if (prewarmedTokenImageUris.size > MAX_TRACKED_TOKEN_IMAGE_URIS) {
    prewarmedTokenImageUris.clear();
  }
  uris.forEach((uri) => prewarmedTokenImageUris.add(uri));
}

/**
 * Warm a token logo before the screen that renders it mounts.
 *
 * Mirrors MarketDetailV2/utils/marketDetailImagePreload, which keeps its own
 * copy and its own de-dup set on purpose: unifying them would change market's
 * prewarm behavior for an earn-only fix. Worth collapsing into one helper in
 * a follow-up, outside a release QA round.
 *
 * `primeCachedImageRefs` fills the decoded ImageRef cache that `useImage()`
 * reads synchronously, so on iOS the logo is on screen at the first frame
 * instead of after a skeleton. It is a no-op on Android by design (reusing a
 * decoded Glide SharedRef across views crashes — see Image/cache.ts), so
 * Android relies on `preloadImages` -> `Image.prefetch` warming Glide's native
 * memory/disk cache, which shortens but does not remove the skeleton frame.
 */
export function prewarmTokenImages(
  source?: ITokenImagePrewarmSource,
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
        !prewarmedTokenImageUris.has(uri) && !prewarmingTokenImageUris.has(uri),
    )
    .slice(0, options?.limit ?? TOKEN_IMAGE_PREWARM_LIMIT);

  if (uris.length === 0) return;

  uris.forEach((uri) => prewarmingTokenImageUris.add(uri));

  void Promise.allSettled([
    preloadImages(uris.map((uri) => ({ uri, optimize: false }))),
    primeCachedImageRefs({
      uris,
      timeoutMs: TOKEN_IMAGE_DECODE_TIMEOUT_MS,
    }),
  ])
    .then(([preloadResult]) => {
      if (preloadResult.status === 'fulfilled' && preloadResult.value) {
        rememberPrewarmedUris(uris);
      }
    })
    .finally(() => {
      uris.forEach((uri) => prewarmingTokenImageUris.delete(uri));
    });
}
