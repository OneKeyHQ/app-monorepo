import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import type {
  IFetchServerTokenDetailParams,
  IServerAccountTokenItem,
} from '@onekeyhq/shared/types/serverToken';
import type {
  IFetchTokenDetailItem,
  IToken,
} from '@onekeyhq/shared/types/token';

import type { IUpdateUnsignedTxParams } from '../../../types';
import type VaultDot from '../Vault';
import type { ApiPromise } from '@polkadot/api';
import type {
  Args,
  BaseTxInfo,
  DecodedUnsignedTx,
  TypeRegistry,
} from '@substrate/txwrapper-polkadot';

export type ISubstrateTxInfo = BaseTxInfo & Record<string, unknown>;

export interface ITokenTransferBuildContext {
  tokenInfo: IToken;
  to: string;
  amountValue: string;
  keepAlive?: boolean;
  info: ISubstrateTxInfo;
  option: {
    metadataRpc: `0x${string}`;
    registry: TypeRegistry;
  };
}

export interface IDecodedAssetIdContext {
  chainId: string;
  pallet: string;
  method: string;
  args: Args;
}

export interface IFetchTokenDetailContext {
  contract: string;
  params: IFetchServerTokenDetailParams;
  apiPromise?: ApiPromise | null;
}

export interface IFetchTokenListContext {
  accountAddress: string;
  apiPromise: ApiPromise;
}

export interface INativeTransferBuildContext {
  to: string;
  amountValue: string;
  keepAlive?: boolean;
  info: ISubstrateTxInfo;
  option: {
    metadataRpc: `0x${string}`;
    registry: TypeRegistry;
  };
  toAccountId: Uint8Array;
}

export interface IUpdateUnsignedTxContext {
  encodedTx: IEncodedTxDot;
  decodedUnsignedTx: DecodedUnsignedTx;
  params: IUpdateUnsignedTxParams;
}

export default class VaultDotSubBase {
  vault: VaultDot;

  constructor(vault: VaultDot) {
    this.vault = vault;
  }

  supportsNetwork(_networkId: string, _chainId: string): boolean {
    return false;
  }

  async getAddressByTxArgs(_args: Args): Promise<string | undefined> {
    return undefined;
  }

  async extractAssetId(
    _context: IDecodedAssetIdContext,
  ): Promise<string | undefined> {
    return undefined;
  }

  async fetchTokenDetailByRpc(
    _context: IFetchTokenDetailContext,
  ): Promise<IFetchTokenDetailItem | undefined> {
    return undefined;
  }

  async fetchAdditionalAccountTokens(
    _context: IFetchTokenListContext,
  ): Promise<IServerAccountTokenItem[]> {
    return [];
  }

  async buildTokenTransfer(
    _context: ITokenTransferBuildContext,
  ): Promise<IEncodedTxDot> {
    throw new NotImplemented('buildTokenTransfer not implemented');
  }

  async buildNativeTransfer(
    _context: INativeTransferBuildContext,
  ): Promise<IEncodedTxDot> {
    throw new NotImplemented('buildNativeTransfer not implemented');
  }

  async updateUnsignedTx(
    _context: IUpdateUnsignedTxContext,
  ): Promise<IEncodedTxDot | undefined> {
    return undefined;
  }
}
