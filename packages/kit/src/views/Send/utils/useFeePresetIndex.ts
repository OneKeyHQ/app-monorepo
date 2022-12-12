import { useAppSelector } from '../../../hooks';

export function useFeePresetIndex(networkId: string) {
  const feePresetIndexMap = useAppSelector((s) => s.data.feePresetIndexMap);
  return feePresetIndexMap?.[networkId];
}
