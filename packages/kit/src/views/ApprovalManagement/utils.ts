import { IToken } from '@onekeyhq/shared/types/token';

function buildSelectedTokenKey({
  contractAddress,
  tokenAddress,
  networkId,
}: {
  contractAddress: string;
  tokenAddress: string;
  networkId: string;
}) {
  return `${networkId}_${contractAddress}_${tokenAddress}`;
}

export { buildSelectedTokenKey };
