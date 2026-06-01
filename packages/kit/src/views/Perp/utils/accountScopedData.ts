import { normalizePerpsAccountAddress } from '@onekeyhq/shared/src/utils/perpsUtils';

type IAccountScopedDataParams<T> = {
  activeAccountAddress?: string | null;
  dataAccountAddress?: string | null;
  data: T[];
};

export function isPerpsAccountScopedDataReady({
  activeAccountAddress,
  dataAccountAddress,
}: {
  activeAccountAddress?: string | null;
  dataAccountAddress?: string | null;
}) {
  const activeAddress = normalizePerpsAccountAddress(activeAccountAddress);
  if (!activeAddress) {
    return !normalizePerpsAccountAddress(dataAccountAddress);
  }
  return normalizePerpsAccountAddress(dataAccountAddress) === activeAddress;
}

export function isPerpsAccountAddressMatched({
  activeAccountAddress,
  dataAccountAddress,
}: {
  activeAccountAddress?: string | null;
  dataAccountAddress?: string | null;
}) {
  const activeAddress = normalizePerpsAccountAddress(activeAccountAddress);
  const dataAddress = normalizePerpsAccountAddress(dataAccountAddress);
  return Boolean(activeAddress && dataAddress && activeAddress === dataAddress);
}

export function getPerpsAccountScopedListData<T>({
  activeAccountAddress,
  dataAccountAddress,
  data,
}: IAccountScopedDataParams<T>) {
  const activeAddress = normalizePerpsAccountAddress(activeAccountAddress);
  if (!activeAddress) {
    return normalizePerpsAccountAddress(dataAccountAddress) ? [] : data;
  }
  return normalizePerpsAccountAddress(dataAccountAddress) === activeAddress
    ? data
    : [];
}

export function shouldPreserveColdStartButtonVisualState({
  isLiveStatusPending,
  hasNonColdStartDisabledReason,
}: {
  isLiveStatusPending?: boolean;
  hasNonColdStartDisabledReason: boolean;
}) {
  return Boolean(isLiveStatusPending && !hasNonColdStartDisabledReason);
}
