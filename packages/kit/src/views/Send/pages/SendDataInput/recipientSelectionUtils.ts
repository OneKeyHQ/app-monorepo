import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';

export function normalizeOptionalRecipientText(value?: string) {
  return value ?? '';
}

function normalizeComparableRecipientAddress(value?: string) {
  const normalized = (value ?? '').trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    return normalized.toLowerCase();
  }
  return normalized;
}

export function shouldSkipResolvedRecipientUpdate({
  currentTo,
  selectedAddress,
}: {
  currentTo?: IAddressInputValue;
  selectedAddress: string;
}) {
  if (!currentTo?.resolved) {
    return false;
  }
  const selected = normalizeComparableRecipientAddress(selectedAddress);
  const currentRaw = normalizeComparableRecipientAddress(currentTo.raw);
  const currentResolved = normalizeComparableRecipientAddress(
    currentTo.resolved,
  );

  return (
    selected.length > 0 &&
    (selected === currentRaw || selected === currentResolved)
  );
}
