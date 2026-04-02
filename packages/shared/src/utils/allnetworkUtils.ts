export function buildAllNetworkId({
  accountId,
  networkId,
  walletId,
}: {
  accountId: string;
  networkId: string;
  walletId: string;
}) {
  return `${accountId}_${networkId}_${walletId}`;
}
