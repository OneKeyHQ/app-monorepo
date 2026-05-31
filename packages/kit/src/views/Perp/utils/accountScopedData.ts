import { normalizePerpsAccountAddress } from '@onekeyhq/shared/src/utils/perpsUtils';

type IAccountScopedDataParams<T> = {
  activeAccountAddress?: string | null;
  dataAccountAddress?: string | null;
  data: T[];
};

type IAccountScopedFallbackListStateParams<T> = IAccountScopedDataParams<T> & {
  fallbackDataAccountAddress?: string | null;
  fallbackData: T[];
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
    return true;
  }
  return normalizePerpsAccountAddress(dataAccountAddress) === activeAddress;
}

export function getPerpsAccountScopedListData<T>({
  activeAccountAddress,
  dataAccountAddress,
  data,
}: IAccountScopedDataParams<T>) {
  const activeAddress = normalizePerpsAccountAddress(activeAccountAddress);
  if (!activeAddress) {
    return normalizePerpsAccountAddress(dataAccountAddress) ? data : [];
  }
  return normalizePerpsAccountAddress(dataAccountAddress) === activeAddress
    ? data
    : [];
}

export function getPerpsAccountScopedFallbackListState<T>({
  activeAccountAddress,
  dataAccountAddress,
  data,
  fallbackDataAccountAddress,
  fallbackData,
}: IAccountScopedFallbackListStateParams<T>) {
  const activeAddress = normalizePerpsAccountAddress(activeAccountAddress);
  const currentDataAddress = normalizePerpsAccountAddress(dataAccountAddress);
  const fallbackDataAddress = normalizePerpsAccountAddress(
    fallbackDataAccountAddress,
  );

  if (
    activeAddress &&
    currentDataAddress !== activeAddress &&
    fallbackDataAddress === activeAddress
  ) {
    return {
      dataAccountAddress: fallbackDataAccountAddress,
      data: fallbackData,
    };
  }

  if (!activeAddress && !currentDataAddress && fallbackDataAddress) {
    return {
      dataAccountAddress: fallbackDataAccountAddress,
      data: fallbackData,
    };
  }

  return {
    dataAccountAddress,
    data,
  };
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
