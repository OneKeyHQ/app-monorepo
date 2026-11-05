import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export function normalizeTaskAccountAddress(
  networkId: string,
  address?: string,
) {
  return address && networkUtils.isEvmNetwork({ networkId })
    ? address.toLowerCase()
    : address;
}
