import type { IAddressValidateStatus } from '@onekeyhq/shared/types/address';

export type IAddressRiskCheckAddressQuery = {
  input?: string;
  validStatus?: IAddressValidateStatus;
  resolveAddress?: string;
  validAddress?: string;
  resolveOptions?: string[];
};

export function isAddressRiskCheckDomainLike(value: string) {
  const input = value.trim();
  return (
    Boolean(input) &&
    !input.toLowerCase().startsWith('0x') &&
    /\./u.test(input) &&
    !/\s/u.test(input)
  );
}

export function getAddressRiskCheckResolvedOptions(
  query: IAddressRiskCheckAddressQuery | undefined,
) {
  if (!query) {
    return [];
  }
  const options = [...new Set(query.resolveOptions?.filter(Boolean) ?? [])];
  if (query.resolveAddress && !options.includes(query.resolveAddress)) {
    options.unshift(query.resolveAddress);
  }
  return options;
}

export function getAddressRiskCheckInputState({
  rawAddress,
  query,
  selectedResolvedAddress,
}: {
  rawAddress: string;
  query: IAddressRiskCheckAddressQuery | undefined;
  selectedResolvedAddress?: string;
}) {
  const input = rawAddress.trim();
  const resolvedOptions = getAddressRiskCheckResolvedOptions(query);
  const isDomainInput = isAddressRiskCheckDomainLike(input);
  const isBlockedStatus =
    query?.validStatus !== undefined &&
    query.validStatus !== 'valid' &&
    query.validStatus !== 'unknown';
  const selectedAddress =
    selectedResolvedAddress && resolvedOptions.includes(selectedResolvedAddress)
      ? selectedResolvedAddress
      : undefined;

  if (!input || !query) {
    return {
      checkAddress: undefined,
      isInvalid: false,
      needsResolvedAddressSelection: false,
      resolvedOptions,
    };
  }

  if (isBlockedStatus) {
    return {
      checkAddress: undefined,
      isInvalid: true,
      needsResolvedAddressSelection: false,
      resolvedOptions,
    };
  }

  if (resolvedOptions.length > 1) {
    return {
      checkAddress: selectedAddress,
      isInvalid: false,
      needsResolvedAddressSelection: !selectedAddress,
      resolvedOptions,
    };
  }

  if (query.resolveAddress) {
    return {
      checkAddress: query.resolveAddress,
      isInvalid: false,
      needsResolvedAddressSelection: false,
      resolvedOptions,
    };
  }

  if (query.validAddress) {
    return {
      checkAddress: query.validAddress,
      isInvalid: false,
      needsResolvedAddressSelection: false,
      resolvedOptions,
    };
  }

  if (query.validStatus === 'valid') {
    if (isDomainInput) {
      return {
        checkAddress: undefined,
        isInvalid: true,
        needsResolvedAddressSelection: false,
        resolvedOptions,
      };
    }
    return {
      checkAddress: query.input?.trim() || input,
      isInvalid: false,
      needsResolvedAddressSelection: false,
      resolvedOptions,
    };
  }

  if (query.validStatus === 'unknown' && !isDomainInput) {
    return {
      checkAddress: input,
      isInvalid: false,
      needsResolvedAddressSelection: false,
      resolvedOptions,
    };
  }

  return {
    checkAddress: undefined,
    isInvalid: query.validStatus === 'unknown' && isDomainInput,
    needsResolvedAddressSelection: false,
    resolvedOptions,
  };
}
