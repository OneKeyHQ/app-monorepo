import { useNetwork } from '../../../hooks';

export function useNetworkFeeInfoEditable({
  networkId,
}: {
  networkId: string;
}) {
  const { network } = useNetwork({ networkId });
  return Boolean(network?.settings?.feeInfoEditable);
}
