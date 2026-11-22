import { parseNetworkId } from './networkIdUtils';

export const caseSensitiveNetworkImpl = [
  'sol',
  'stc',
  'tron',
  'aptos',
  'sui',
  'ton',
];

export function normalizeTokenContractAddress({
  networkId,
  contractAddress,
}: {
  networkId: string;
  contractAddress: string | undefined;
}): string | undefined {
  const { impl } = parseNetworkId({ networkId });
  return caseSensitiveNetworkImpl.includes(impl)
    ? contractAddress
    : contractAddress?.toLowerCase();
}
