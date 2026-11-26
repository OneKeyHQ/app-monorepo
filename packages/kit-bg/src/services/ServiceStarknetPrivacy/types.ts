import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import type {
  IStrk20AccountKey,
  IStrk20PrivacyNetworkConfig,
  IStrk20PrivateBalances,
} from '@onekeyhq/shared/types/starknetPrivacy';

import type { IDBAccount } from '../../dbs/local/types';
import type ClientStarknet from '../../vaults/impls/starknet/sdkStarknet/ClientStarknet';
import type {
  IStrk20InternalHistoryCursor,
  createStrk20Transfers,
} from '../../vaults/impls/starknet/strk20Adapter';
import type StarknetVault from '../../vaults/impls/starknet/Vault';

export type IViewingKeyCacheEntry = {
  viewingKey: string;
  publicKeyX: string;
};

export type IPrivateBalanceQuery = IStrk20AccountKey & {
  tokenAddresses?: string[];
};

export type IPrivateBalanceSnapshot = IStrk20PrivateBalances & {
  lastSyncedAt: number;
};

export type IStoredHistoryCursor = IStrk20InternalHistoryCursor & {
  scopeKey: string;
  generation: number;
  keyGeneration: number;
};

export type IStarknetPrivacyScope = IStrk20AccountKey & {
  poolAddress: string;
};

export type IStarknetPrivacyCredentials = {
  password: string;
  deviceParams?: IDeviceSharedCallParams;
};

export type IStarknetPrivacyContext = {
  config: IStrk20PrivacyNetworkConfig;
  poolAddress: string;
  vault: StarknetVault;
  client: ClientStarknet;
  account: IDBAccount;
  network: IServerNetwork;
  viewing: IViewingKeyCacheEntry;
  buildTransfers: () => ReturnType<typeof createStrk20Transfers>;
  resolvePassword: () => Promise<string>;
  assertSession: () => void;
};

export type IStarknetVaultResolver = (p: {
  networkId: string;
  accountId?: string;
}) => Promise<StarknetVault>;

export function buildPrivacyCacheKey(p: IStarknetPrivacyScope): string {
  return [p.networkId, p.accountId, p.poolAddress.toLowerCase()].join('_');
}

export function buildPrivacyKeyScope(p: {
  networkId: string;
  poolAddress: string;
}): string {
  return `${p.networkId}:${p.poolAddress.toLowerCase()}`;
}
