type ISwapAddressInfoOwner = {
  account?: { id?: string };
  indexedAccount?: { id?: string };
  dbAccount?: { id?: string };
};

export function isSwapAddressInfoReadyForOwner({
  address,
  isAddressInfoReady,
  owner,
}: {
  address?: string;
  isAddressInfoReady: boolean;
  owner?: ISwapAddressInfoOwner;
}) {
  if (!isAddressInfoReady) {
    return false;
  }

  const hasAccountOwner = Boolean(
    owner?.account?.id || owner?.indexedAccount?.id || owner?.dbAccount?.id,
  );
  return !hasAccountOwner || Boolean(address);
}
