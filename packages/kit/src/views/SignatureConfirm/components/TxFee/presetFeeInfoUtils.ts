import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IFeeInfoUnit,
  IGasEIP1559,
  IGasLegacy,
} from '@onekeyhq/shared/types/fee';

type IPresetMultiTxFee = {
  gas?: IGasLegacy[];
  gasEIP1559?: IGasEIP1559[];
};

export function buildPresetMultiTxsFee(unsignedTxs: IUnsignedTxPro[]) {
  if (unsignedTxs.length <= 1) {
    return undefined;
  }

  const feeInfos = unsignedTxs.map((unsignedTx) => unsignedTx.feeInfo);

  if (feeInfos.some((feeInfo) => !feeInfo?.common)) {
    return undefined;
  }

  const common = (feeInfos[0] as IFeeInfoUnit).common;
  const txFees: IPresetMultiTxFee[] = feeInfos.map((feeInfo) => ({
    gas: feeInfo?.gas ? [feeInfo.gas] : undefined,
    gasEIP1559: feeInfo?.gasEIP1559 ? [feeInfo.gasEIP1559] : undefined,
  }));

  if (txFees.some((fee) => !fee.gas && !fee.gasEIP1559)) {
    return undefined;
  }

  return {
    common,
    txFees,
  };
}
