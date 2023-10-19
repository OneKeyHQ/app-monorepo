import type { IAdaUTXO } from '../types';

export enum CardanoAddressType {
  BASE = 0,
  BASE_SCRIPT_KEY = 1,
  BASE_KEY_SCRIPT = 2,
  BASE_SCRIPT_SCRIPT = 3,
  POINTER = 4,
  POINTER_SCRIPT = 5,
  ENTERPRISE = 6,
  ENTERPRISE_SCRIPT = 7,
  BYRON = 8,
  REWARD = 14,
  REWARD_SCRIPT = 15,
}

interface Utxo {
  address: string;
  txHash: string;
  outputIndex: number;
  amount: Asset[];
}

interface Asset {
  unit: string;
  quantity: string;
}

interface CardanoInput {
  path?: string | number[];
  prev_hash: string;
  prev_index: number;
}

interface AssetInPolicy {
  assetNameBytes: string;
  amount: string;
}

export interface BaseOutput {
  setMax?: boolean;
  isChange?: boolean;
  assets: Asset[];
}

export interface ExternalOutput extends BaseOutput {
  amount: string;
  address: string;
  setMax?: false;
}

export interface ExternalOutputIncomplete extends BaseOutput {
  amount?: string | undefined;
  address?: string;
  setMax: boolean;
}

export interface ChangeOutput extends BaseOutput {
  amount: string;
  address: string;
  isChange: true;
}

export type FinalOutput = ExternalOutput | ChangeOutput;

export type CardanoToken = {
  assetNameBytes: string;
  amount: string;
};

export type CardanoAssetGroup = {
  policyId: string;
  tokenAmounts: CardanoToken[];
};

export interface CardanoCertificatePointer {
  blockIndex: number;
  txIndex: number;
  certificateIndex: number;
}

export interface CardanoAddressParameters {
  addressType: CardanoAddressType;
  path: string | number[];
  stakingPath?: string | number[];
  stakingKeyHash?: string;
  certificatePointer?: CardanoCertificatePointer;
}

export type CardanoOutput =
  | {
      addressParameters: CardanoAddressParameters;
      amount: string;
      tokenBundle?: CardanoAssetGroup[];
    }
  | {
      address: string;
      amount: string;
      tokenBundle?: CardanoAssetGroup[];
    };

export const transformToOneKeyInputs = (
  utxos: Utxo[],
  onekeyUtxos: IAdaUTXO[],
): CardanoInput[] =>
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

export const transformToTokenBundle = (assets: Asset[]) => {
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
    tokenAmounts: AssetInPolicy[];
  }[] = [];
  uniquePolicies.forEach((policyId) => {
    const assetsInPolicy: AssetInPolicy[] = [];
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
  outputs: FinalOutput[],
  changeAddressParameters: CardanoAddressParameters,
): CardanoOutput[] =>
  outputs.map((output) => {
    let params:
      | { address: string }
      | { addressParameters: CardanoAddressParameters };

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
