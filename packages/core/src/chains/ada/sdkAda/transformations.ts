import { HARDWARE_CARDANO_ADDRESS_TYPE } from '@onekeyhq/shared/src/hardware/transportEnumValues';

import type { IAdaUTXO } from '../types';
import type { CardanoAddressType } from '@onekeyfe/hd-transport';

export type ECardanoAddressType = CardanoAddressType;
export const ECardanoAddressType = {
  BASE: HARDWARE_CARDANO_ADDRESS_TYPE.BASE as CardanoAddressType.BASE,
  BASE_SCRIPT_KEY:
    HARDWARE_CARDANO_ADDRESS_TYPE.BASE_SCRIPT_KEY as CardanoAddressType.BASE_SCRIPT_KEY,
  BASE_KEY_SCRIPT:
    HARDWARE_CARDANO_ADDRESS_TYPE.BASE_KEY_SCRIPT as CardanoAddressType.BASE_KEY_SCRIPT,
  BASE_SCRIPT_SCRIPT:
    HARDWARE_CARDANO_ADDRESS_TYPE.BASE_SCRIPT_SCRIPT as CardanoAddressType.BASE_SCRIPT_SCRIPT,
  POINTER: HARDWARE_CARDANO_ADDRESS_TYPE.POINTER as CardanoAddressType.POINTER,
  POINTER_SCRIPT:
    HARDWARE_CARDANO_ADDRESS_TYPE.POINTER_SCRIPT as CardanoAddressType.POINTER_SCRIPT,
  ENTERPRISE:
    HARDWARE_CARDANO_ADDRESS_TYPE.ENTERPRISE as CardanoAddressType.ENTERPRISE,
  ENTERPRISE_SCRIPT:
    HARDWARE_CARDANO_ADDRESS_TYPE.ENTERPRISE_SCRIPT as CardanoAddressType.ENTERPRISE_SCRIPT,
  BYRON: HARDWARE_CARDANO_ADDRESS_TYPE.BYRON as CardanoAddressType.BYRON,
  REWARD: HARDWARE_CARDANO_ADDRESS_TYPE.REWARD as CardanoAddressType.REWARD,
  REWARD_SCRIPT:
    HARDWARE_CARDANO_ADDRESS_TYPE.REWARD_SCRIPT as CardanoAddressType.REWARD_SCRIPT,
} as const;

interface IAdaUtxo {
  address: string;
  txHash: string;
  outputIndex: number;
  amount: IAdaAsset[];
}

interface IAdaAsset {
  unit: string;
  quantity: string;
}

interface ICardanoInput {
  path?: string | number[];
  prev_hash: string;
  prev_index: number;
}

interface IAdaAssetInPolicy {
  assetNameBytes: string;
  amount: string;
}

export interface IAdaBaseOutput {
  setMax?: boolean;
  isChange?: boolean;
  assets: IAdaAsset[];
}

export interface IAdaExternalOutput extends IAdaBaseOutput {
  amount: string;
  address: string;
  setMax?: false;
}

export interface IAdaExternalOutputIncomplete extends IAdaBaseOutput {
  amount?: string | undefined;
  address?: string;
  setMax: boolean;
}

export interface IAdaChangeOutput extends IAdaBaseOutput {
  amount: string;
  address: string;
  isChange: true;
}

export type IAdaFinalOutput = IAdaExternalOutput | IAdaChangeOutput;

export type ICardanoToken = {
  assetNameBytes: string;
  amount: string;
};

export type ICardanoAssetGroup = {
  policyId: string;
  tokenAmounts: ICardanoToken[];
};

export interface ICardanoCertificatePointer {
  blockIndex: number;
  txIndex: number;
  certificateIndex: number;
}

export interface ICardanoAddressParameters {
  addressType: ECardanoAddressType;
  path: string | number[];
  stakingPath?: string | number[];
  stakingKeyHash?: string;
  certificatePointer?: ICardanoCertificatePointer;
}

export type ICardanoOutput =
  | {
      addressParameters: ICardanoAddressParameters;
      amount: string;
      tokenBundle?: ICardanoAssetGroup[];
    }
  | {
      address: string;
      amount: string;
      tokenBundle?: ICardanoAssetGroup[];
    };

export const transformToOneKeyInputs = (
  utxos: IAdaUtxo[],
  onekeyUtxos: IAdaUTXO[],
): ICardanoInput[] =>
  utxos.map((utxo) => {
    const utxoWithPath = onekeyUtxos.find(
      (u) => u.tx_hash === utxo.txHash && +u.output_index === utxo.outputIndex,
    );
    if (!utxoWithPath)
      throw Error(`Cannot transform utxo ${utxo.txHash}:${utxo.outputIndex}`);

    return {
      path: utxoWithPath.path,
      prev_hash: utxo.txHash,
      prev_index: utxo.outputIndex,
    };
  });

export const parseAsset = (
  hex: string,
): {
  policyId: string;
  assetNameInHex: string;
} => {
  const policyIdSize = 56;
  const policyId = hex.slice(0, policyIdSize);
  const assetNameInHex = hex.slice(policyIdSize);
  return {
    policyId,
    assetNameInHex,
  };
};

export const transformToTokenBundle = (assets: IAdaAsset[]) => {
  // prepare token bundle used in trezor output
  if (assets.length === 0) return undefined;

  const uniquePolicies: string[] = [];
  assets.forEach((asset) => {
    const { policyId } = parseAsset(asset.unit);
    if (!uniquePolicies.includes(policyId)) {
      uniquePolicies.push(policyId);
    }
  });

  const assetsByPolicy: {
    policyId: string;
    tokenAmounts: IAdaAssetInPolicy[];
  }[] = [];
  uniquePolicies.forEach((policyId) => {
    const assetsInPolicy: IAdaAssetInPolicy[] = [];
    assets.forEach((asset) => {
      const assetInfo = parseAsset(asset.unit);
      if (assetInfo.policyId !== policyId) return;

      assetsInPolicy.push({
        assetNameBytes: assetInfo.assetNameInHex,
        amount: asset.quantity,
      });
    });
    assetsByPolicy.push({
      policyId,
      tokenAmounts: assetsInPolicy,
    });
  });

  return assetsByPolicy;
};

export const transformToOneKeyOutputs = (
  outputs: IAdaFinalOutput[],
  changeAddressParameters: ICardanoAddressParameters,
): ICardanoOutput[] =>
  outputs.map((output) => {
    let params:
      | { address: string }
      | { addressParameters: ICardanoAddressParameters };

    if (output.isChange) {
      params = {
        addressParameters: changeAddressParameters,
      };
    } else {
      params = {
        address: output.address,
      };
    }

    return {
      ...params,
      amount: output.amount,
      tokenBundle: transformToTokenBundle(output.assets),
    };
  });
