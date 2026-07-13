import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

function normalizeProviderKey(value?: string) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_') ?? ''
  );
}

function normalizeDisplayName(value?: string) {
  const trimmed = value?.trim();
  if (trimmed?.toLowerCase() === 'unknown') {
    return undefined;
  }
  return trimmed || undefined;
}

function humanizeProviderId(value?: string) {
  const providerKey = normalizeProviderKey(value);
  if (!providerKey) {
    return undefined;
  }

  return providerKey
    .split('_')
    .filter(Boolean)
    .map((part) => {
      if (/^v\d+$/i.test(part) || part.length <= 3) {
        return part.toUpperCase();
      }
      return `${part[0].toUpperCase()}${part.slice(1)}`;
    })
    .join(' ');
}

function resolveEarnProviderDisplayName(provider: string) {
  const earnProviderName = earnUtils.getEarnProviderName({
    providerName: provider,
  });
  return normalizeDisplayName(earnProviderName);
}

function getProtocolProviderDisplayName({
  provider,
  providerDisplayName,
  providerDetailName,
}: {
  provider: string;
  providerDisplayName?: string;
  providerDetailName?: string;
}) {
  const providerKey = normalizeProviderKey(provider);
  const providerDetailDisplayName =
    normalizeProviderKey(providerDetailName) === providerKey
      ? undefined
      : normalizeDisplayName(providerDetailName);

  return (
    normalizeDisplayName(providerDisplayName) ||
    providerDetailDisplayName ||
    resolveEarnProviderDisplayName(provider) ||
    humanizeProviderId(provider) ||
    'Unknown'
  );
}

export { getProtocolProviderDisplayName };
