import { ensureHttpsPrefix } from '@onekeyhq/shared/src/utils/uriUtils';

const allowedLinkProtocols = new Set(['http:', 'https:', 'mailto:']);

const safeDataImagePattern =
  /^data:image\/(?:gif|jpeg|png);base64,[a-z\d+/=\s]+$/i;

export function getSafeMarkdownHref(href: string | undefined) {
  const normalizedHref = ensureHttpsPrefix(href?.trim() ?? '');
  if (!normalizedHref) {
    return undefined;
  }

  try {
    return allowedLinkProtocols.has(new URL(normalizedHref).protocol)
      ? normalizedHref
      : undefined;
  } catch {
    return undefined;
  }
}

export function getSafeMarkdownImageUri(src: string | undefined) {
  const normalizedSource = src?.trim();
  if (!normalizedSource) {
    return undefined;
  }
  if (safeDataImagePattern.test(normalizedSource)) {
    return normalizedSource;
  }

  const httpsSource = ensureHttpsPrefix(normalizedSource);
  try {
    return new URL(httpsSource).protocol === 'https:' ? httpsSource : undefined;
  } catch {
    return undefined;
  }
}
