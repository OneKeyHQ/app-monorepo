function buildContractMapKey({
  networkId,
  contractAddress,
}: {
  networkId: string;
  contractAddress: string;
}) {
  return `${networkId}_${contractAddress}`;
}

function buildTokenMapKey({
  networkId,
  tokenAddress,
}: {
  networkId: string;
  tokenAddress: string;
}) {
  return `${networkId}_${tokenAddress}`;
}

export default {
  buildContractMapKey,
  buildTokenMapKey,
};
