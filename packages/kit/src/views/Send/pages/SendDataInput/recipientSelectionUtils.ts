import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';

export function normalizeOptionalRecipientText(value?: string) {
  return value ?? '';
}

export function shouldSkipResolvedRecipientUpdate({
  currentTo,
  selectedAddress,
}: {
  currentTo?: IAddressInputValue;
  selectedAddress: string;
}) {
  return currentTo?.raw === selectedAddress && !!currentTo?.resolved;
}
