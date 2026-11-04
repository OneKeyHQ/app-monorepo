import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import { ENFTType } from '@onekeyhq/shared/types/nft';

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

export function shouldSkipAmountInputForNFT({
  isNFT,
  nft,
}: {
  isNFT: boolean;
  nft?: Pick<IAccountNFT, 'collectionType'>;
}) {
  return !!(isNFT && nft && nft.collectionType !== ENFTType.ERC1155);
}

export function getSendAddressRiskCheckButtonState({
  currentNetworkId,
  supportNetworkId,
  isSupported,
  canRunCheck,
  resolvedAddress,
  isPending,
}: {
  currentNetworkId: string;
  supportNetworkId: string;
  isSupported: boolean;
  // Prime, a logged-in free user with the feature open (uses left or not), or
  // a logged-out user who logs in on the press: the press checks the address.
  // Otherwise the press opens the dashboard and the button stays enabled.
  canRunCheck: boolean;
  resolvedAddress?: string;
  isPending?: boolean;
}) {
  if (supportNetworkId !== currentNetworkId) return 'loading';
  if (!isSupported) return 'hidden';
  if (!canRunCheck) return 'enabled';
  if (!resolvedAddress?.trim() || isPending) return 'disabled';
  return 'enabled';
}
