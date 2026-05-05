import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function shouldRenderContractAddress({
  address,
  isLegacyNavigation,
}: {
  address?: string;
  isLegacyNavigation: boolean;
}) {
  if (isLegacyNavigation) {
    return false;
  }

  return Boolean(address?.trim());
}

export function formatContractAddress(address: string) {
  if (!address) {
    return '';
  }

  return accountUtils.shortenAddress({
    address,
    leadingLength: 6,
    trailingLength: 4,
  });
}
