import { TRADING_VIEW_EMBED_PINNED_RELEASES } from './tradingViewEmbedPinnedReleases';

import type { ITradingViewEmbedRelease } from './tradingViewEmbedPinnedReleases';

export type { ITradingViewEmbedRelease };

export function getTradingViewEmbedRelease(
  origin: string,
): ITradingViewEmbedRelease | undefined {
  return Object.prototype.hasOwnProperty.call(
    TRADING_VIEW_EMBED_PINNED_RELEASES,
    origin,
  )
    ? TRADING_VIEW_EMBED_PINNED_RELEASES[origin]
    : undefined;
}

export function getTradingViewEmbedReleaseManifestUrl(
  origin: string,
): string | undefined {
  const release = getTradingViewEmbedRelease(origin);
  return release
    ? new URL(
        `/${release.version}/embed/embed-manifest.json`,
        origin,
      ).toString()
    : undefined;
}

// Only the exact pinned manifest URL of an origin identifies its release.
export function getTradingViewEmbedReleaseForManifestUrl(
  manifestUrl: string,
): ITradingViewEmbedRelease | undefined {
  let url: URL;
  try {
    url = new URL(manifestUrl);
  } catch {
    return undefined;
  }
  return getTradingViewEmbedReleaseManifestUrl(url.origin) === url.toString()
    ? getTradingViewEmbedRelease(url.origin)
    : undefined;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return globalThis.btoa(binary);
}

export async function computeTradingViewEmbedIntegrity(
  bytes: BufferSource,
): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-384', bytes);
  return `sha384-${encodeBase64(new Uint8Array(digest))}`;
}

export async function isTradingViewEmbedManifestIntegrityValid(
  bytes: BufferSource,
  release: ITradingViewEmbedRelease,
): Promise<boolean> {
  return (
    (await computeTradingViewEmbedIntegrity(bytes)) ===
    release.manifestIntegrity
  );
}
