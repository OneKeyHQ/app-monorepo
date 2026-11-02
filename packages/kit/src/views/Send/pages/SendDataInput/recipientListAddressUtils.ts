import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

const LEAD_LENGTH = 8;
const LEAD_AFTER_PREFIX = 6;
const TAIL_LENGTH = 6;

// Lightning addresses (alice@getalby.com) and named accounts (alice.near)
// are read as names, so they are never cut.
function isNameLikeAddress(address: string): boolean {
  return address.includes('@') || address.includes('.');
}

// Short form for the recipient list: at least the usual first 8 characters,
// and always 6 past a long prefix, then the last 6.
export function shortenRecipientAddress(address: string): string {
  if (!address || isNameLikeAddress(address)) {
    return address;
  }
  const leadingLength = Math.max(
    LEAD_LENGTH,
    accountUtils.getAddressPrefix(address).length + LEAD_AFTER_PREFIX,
  );
  return accountUtils.shortenAddress({
    address,
    leadingLength,
    trailingLength: TAIL_LENGTH,
    // Cut only when it saves characters: the "..." takes three.
    minLength: leadingLength + TAIL_LENGTH + 3,
  });
}

// Shared by every list without lookalikes, so it keeps one identity.
const NO_LOOKALIKES: ReadonlySet<string> = new Set<string>();

// Addresses among `addresses` that look like another one, by the rule the
// address poisoning warning uses; check rows with isLookalikeAddress. Names
// are left out.
export function findLookalikeAddresses(
  addresses: string[],
): ReadonlySet<string> {
  const lookalikes = accountUtils.findSimilarAddresses(
    addresses.filter((address) => address && !isNameLikeAddress(address)),
  );
  return lookalikes.size ? lookalikes : NO_LOOKALIKES;
}

export function isLookalikeAddress(
  lookalikes: ReadonlySet<string> | undefined,
  address: string,
): boolean {
  return (
    !!lookalikes?.size && accountUtils.isInSimilarAddresses(lookalikes, address)
  );
}

// Whether `candidate` looks like one of `addresses`, the way a pasted copy of
// a listed account with only its middle changed does. The same address does
// not count.
export function looksLikeListedAddress(
  addresses: string[],
  candidate: string,
): boolean {
  return isLookalikeAddress(
    findLookalikeAddresses([...addresses, candidate]),
    candidate,
  );
}

// "Tag 104523987" or "Note …": the field the Send page fills with it.
export function formatRecipientExtra({
  memo,
  note,
  tagLabel,
  noteLabel,
}: {
  memo?: string;
  note?: string;
  tagLabel: string;
  noteLabel: string;
}): string | undefined {
  const value = memo || note;
  if (!value) {
    return undefined;
  }
  return `${memo ? tagLabel : noteLabel} ${accountUtils.shortenAddress({
    address: value,
    leadingLength: 6,
    trailingLength: 4,
  })}`;
}

// The second line of a recipient row: the full address while searching or
// when it looks like another one, otherwise the details on one line with
// `before` first, then the tag or note, then `after`, so what comes last is
// what gets cut.
export function getRecipientDetailText({
  address,
  extra,
  showFullAddress,
  before = [],
  after = [],
}: {
  address: string;
  extra?: string;
  showFullAddress: boolean;
  before?: (string | undefined)[];
  after?: (string | undefined)[];
}): { text: string | undefined; isFullAddress: boolean } {
  if (showFullAddress && address) {
    return {
      text: extra ? `${address} · ${extra}` : address,
      isFullAddress: true,
    };
  }
  const text = [...before, extra, ...after].filter(Boolean).join(' · ');
  return { text: text || undefined, isFullAddress: false };
}
