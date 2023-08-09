import { useAppSelector } from '../../../hooks';
import { selectFeePresetIndexMap } from '../../../store/selectors';

export function useFeePresetIndex(networkId: string) {
  const feePresetIndexMap = useAppSelector(selectFeePresetIndexMap);
  return feePresetIndexMap?.[networkId];
}
