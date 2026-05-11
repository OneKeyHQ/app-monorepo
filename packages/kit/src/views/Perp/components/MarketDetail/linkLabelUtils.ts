const LINK_LABELS_TO_KEEP = new Set([
  'X',
  'Telegram',
  'Discord',
  'LinkedIn',
  'Website',
  'White paper',
  'Official website',
]);

function getHostname(url?: string) {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function getPrimaryHostname(hostname: string) {
  const parts = hostname.split('.').filter(Boolean);

  if (parts.length <= 1) {
    return hostname;
  }

  if (parts.length === 2) {
    return parts[0];
  }

  const tld = parts.at(-1) ?? '';
  const secondLevelSuffix = parts.at(-2) ?? '';
  const commonCountryCodeSuffixes = new Set([
    'co',
    'com',
    'org',
    'net',
    'gov',
    'ac',
  ]);

  if (
    tld.length === 2 &&
    commonCountryCodeSuffixes.has(secondLevelSuffix) &&
    parts.length >= 3
  ) {
    return parts.at(-3) ?? hostname;
  }

  return parts.at(-2) ?? hostname;
}

export function formatExternalLinkLabel({
  label,
  url,
}: {
  label: string;
  url?: string;
}) {
  const trimmedLabel = label.trim();

  if (!trimmedLabel || LINK_LABELS_TO_KEEP.has(trimmedLabel)) {
    return trimmedLabel;
  }

  const hostname = getHostname(url);
  if (!hostname) {
    return trimmedLabel;
  }

  if (
    trimmedLabel.includes('.') ||
    trimmedLabel.includes('/') ||
    trimmedLabel.length > 18
  ) {
    return getPrimaryHostname(hostname);
  }

  return trimmedLabel;
}
