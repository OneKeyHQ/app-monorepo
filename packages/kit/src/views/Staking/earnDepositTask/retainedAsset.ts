import { normalizeTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAddress';
import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

export function findRetainedDepositAsset({
  assets,
  networkId,
  inputTokenAddress,
}: {
  assets: IEarnTokenItem[];
  networkId: string;
  inputTokenAddress: string;
}) {
  return assets.find(({ info }) => {
    if (!inputTokenAddress) return info.isNative;
    return (
      !info.isNative &&
      Boolean(info.address) &&
      normalizeTaskAccountAddress(networkId, info.address) ===
        normalizeTaskAccountAddress(networkId, inputTokenAddress)
    );
  });
}
