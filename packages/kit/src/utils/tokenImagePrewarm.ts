import { preloadImages } from '@onekeyhq/components/src/primitives/Image/preload';

import { getTokenImageResizeWidth } from '../components/Token/tokenSize';

export type ITokenImagePrewarmSource = {
  tokenImageUri?: string;
  tokenImageUris?: string[];
};

const TOKEN_IMAGE_PREWARM_LIMIT = 4;
const TOKEN_IMAGE_PREWARM_RESIZE_WIDTH = getTokenImageResizeWidth('md');
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

export function getTokenImagePrewarmSource({
  uri,
  pixelRatio,
}: {
  uri: string;
  pixelRatio?: number;
}) {
  return {
    uri,
    resizeWidth: TOKEN_IMAGE_PREWARM_RESIZE_WIDTH,
    pixelRatio,
  };
}

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

  void preloadImages(uris.map((uri) => getTokenImagePrewarmSource({ uri })))
    .then((success) => {
      if (success) {
        rememberPrewarmedUris(uris);
      }
    })
    .finally(() => {
      uris.forEach((uri) => prewarmingTokenImageUris.delete(uri));
    });
}
