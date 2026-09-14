import type {
  IEarnProtocolIntroInfo,
  IEarnProtocolIntroItem,
  IEarnProtocolIntroText,
} from '@onekeyhq/shared/types/staking';

function firstNonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function capitalize(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toPlainText(value: IEarnProtocolIntroText | undefined) {
  if (typeof value === 'string') {
    return firstNonEmpty(value);
  }
  return firstNonEmpty(value?.text);
}

// protocolInfo arrives either as the item list or wrapped in an object, and
// each label is either a plain string or an IEarnText. Mirrors getItemTitle in
// ProtocolIntroSection so the header and the Protocol tab name the same thing.
export function pickProtocolInfoDisplayName(
  protocolInfo: IEarnProtocolIntroItem[] | IEarnProtocolIntroInfo | undefined,
): string | undefined {
  const items = Array.isArray(protocolInfo)
    ? protocolInfo
    : protocolInfo?.items;
  const first = items?.[0];
  return (
    toPlainText(first?.title) ??
    toPlainText(first?.displayName) ??
    toPlainText(first?.name)
  );
}

// Header subtitle under the token symbol, e.g. "USDT / Morpho".
//
// providerDetail.name is preferred because it is a required field on the
// protocol record and is the same source as the provider logo. protocolInfo is
// only a fallback: stakeProtocolV2 degrades it to null when the lookup fails.
export function resolveProviderSubtitle({
  title,
  providerDetailName,
  protocolInfoDisplayName,
  provider,
}: {
  title: string | undefined;
  providerDetailName: string | undefined;
  protocolInfoDisplayName: string | undefined;
  provider: string | undefined;
}): string | undefined {
  const candidate =
    firstNonEmpty(providerDetailName) ??
    firstNonEmpty(protocolInfoDisplayName) ??
    capitalize(firstNonEmpty(provider));

  if (!candidate) {
    return undefined;
  }
  // The subtitle only earns its line when it says something the title does not.
  if (title && candidate.toLowerCase() === title.trim().toLowerCase()) {
    return undefined;
  }
  return candidate;
}
