import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

const LEAD_LENGTH = 8;
const LEAD_AFTER_PREFIX = 6;
const TAIL_LENGTH = 6;
// accountUtils.isSimilarAddress needs 8 matching characters at the two ends
// together, so two lookalikes always share 4 at one end.
const BUCKET_CHARS = 4;
const BECH32_DATA = /^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/;

// Lightning addresses (alice@getalby.com) and named accounts (alice.near)
// are read as names, so they are never cut.
function isNameLikeAddress(address: string): boolean {
  return address.includes('@') || address.includes('.');
}

// The part every address of a chain starts with: "0x", a bech32 prefix such
// as "bc1" or "cosmos1", or a scheme ending in ":". It says nothing about
// which address it is.
export function getAddressPrefix(address: string): string {
  const colonIndex = address.indexOf(':');
  if (colonIndex > 0 && /^[a-z]+$/.test(address.slice(0, colonIndex))) {
    return address.slice(0, colonIndex + 1);
  }
  // Bech32 separates its prefix with the last "1", a character the data
  // part never uses.
  const separatorIndex = address.lastIndexOf('1');
  if (
    separatorIndex > 0 &&
    /^[a-z][a-z0-9_]*$/.test(address.slice(0, separatorIndex)) &&
    BECH32_DATA.test(address.slice(separatorIndex + 1))
  ) {
    return address.slice(0, separatorIndex + 1);
  }
  if (/^0x[0-9a-f]+$/i.test(address)) {
    return address.slice(0, 2);
  }
  return '';
}

// Short form for the recipient list: at least the usual first 8 characters,
// and always 6 past a long prefix, then the last 6.
export function shortenRecipientAddress(address: string): string {
  if (!address || isNameLikeAddress(address)) {
    return address;
  }
  const leadingLength = Math.max(
    LEAD_LENGTH,
    getAddressPrefix(address).length + LEAD_AFTER_PREFIX,
  );
  return accountUtils.shortenAddress({
    address,
    leadingLength,
    trailingLength: TAIL_LENGTH,
    // Cut only when it saves characters: the "..." takes three.
    minLength: leadingLength + TAIL_LENGTH + 3,
  });
}

// What two addresses are compared by: the part after the prefix, ignoring
// case for hex, where case is only a checksum.
function getComparableAddress(address: string): string {
  const prefix = getAddressPrefix(address);
  const rest = address.slice(prefix.length);
  return prefix.toLowerCase() === '0x' ? rest.toLowerCase() : rest;
}

// Shared by every list without lookalikes, so it keeps one identity.
export const NO_LOOKALIKES: ReadonlySet<string> = new Set<string>();

// Addresses among `addresses` that look like another one, as comparable
// keys; check rows with isLookalikeAddress. The lists can hold every
// account and contact, so only addresses of one length that share their
// first or last characters are compared.
export function findLookalikeAddresses(
  addresses: string[],
): ReadonlySet<string> {
  const buckets = new Map<string, string[]>();
  new Set(
    addresses
      .filter((address) => address && !isNameLikeAddress(address))
      .map(getComparableAddress),
  ).forEach((key) => {
    [
      `${key.length}^${key.slice(0, BUCKET_CHARS)}`,
      `${key.length}$${key.slice(-BUCKET_CHARS)}`,
    ].forEach((bucketKey) => {
      const bucket = buckets.get(bucketKey);
      if (bucket) {
        bucket.push(key);
      } else {
        buckets.set(bucketKey, [key]);
      }
    });
  });
  let lookalikes: Set<string> | undefined;
  buckets.forEach((bucket) => {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        if (accountUtils.isSimilarAddress(bucket[i], bucket[j])) {
          if (!lookalikes) {
            lookalikes = new Set();
          }
          lookalikes.add(bucket[i]);
          lookalikes.add(bucket[j]);
        }
      }
    }
  });
  return lookalikes ?? NO_LOOKALIKES;
}

export function isLookalikeAddress(
  lookalikes: ReadonlySet<string> | undefined,
  address: string,
): boolean {
  return !!lookalikes?.size && lookalikes.has(getComparableAddress(address));
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
