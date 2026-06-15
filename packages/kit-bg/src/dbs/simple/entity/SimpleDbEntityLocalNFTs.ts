import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Per-account NFT array cap. NFT entries embed full-resolution image URLs and
// metadata, so an NFT-whale account can bloat this map. Pure cache (re-fetched),
// so capping is safe; 500 covers the visible list comfortably.
const LOCAL_NFTS_MAX_PER_ACCOUNT = 500;

export interface ILocalNFTs {
  list: Record<string, IAccountNFT[]>; // <networkId_accountAddress/xpub, nfts>
}

export class SimpleDbEntityLocalNFTs extends SimpleDbEntityBase<ILocalNFTs> {
  entityName = 'LocalNFTs';

  override enableCache = false;

  @backgroundMethod()
  async updateAccountNFTs({
    networkId,
    accountAddress,
    xpub,
    nfts,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    nfts: IAccountNFT[];
  }) {
    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const key = accountUtils.buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });

    await this.setRawData((rawData) => ({
      list: {
        ...rawData?.list,
        [key]: nfts.slice(0, LOCAL_NFTS_MAX_PER_ACCOUNT),
      },
    }));
  }

  @backgroundMethod()
  async updateAccountNFTsByCache(nfts: Record<string, IAccountNFT[]>) {
    const capped: Record<string, IAccountNFT[]> = {};
    for (const [key, value] of Object.entries(nfts)) {
      capped[key] = value.slice(0, LOCAL_NFTS_MAX_PER_ACCOUNT);
    }
    await this.setRawData((rawData) => ({
      list: {
        ...rawData?.list,
        ...capped,
      },
    }));
  }

  @backgroundMethod()
  async getAccountNFTs({
    networkId,
    accountAddress,
    xpub,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
  }) {
    const key = accountUtils.buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });

    return (await this.getRawData())?.list?.[key] || [];
  }

  // Drop cached NFT lists belonging to deleted accounts and cap surviving arrays.
  // `validOwners` is the set of lowercased addresses/xpubs of all surviving
  // accounts. Pure-cache cleanup. See ServiceAppCleanup.cleanupOrphanedAssetCaches.
  @backgroundMethod()
  async removeOrphanData({ validOwners }: { validOwners: string[] }) {
    const existing = await this.getRawData();
    if (!existing) {
      return;
    }
    const validOwnerSet = new Set(validOwners.map((o) => o.toLowerCase()));
    await this.setRawData((rawData) => {
      // Trust the in-mutex fresh value, not the pre-mutex `existing` snapshot: a
      // concurrent clearRawData ("Clear cache" calls localNFTs.clearRawData)
      // nulls the store, and falling back to `existing` would resurrect it.
      const list = rawData?.list ?? {};
      const nextList: Record<string, IAccountNFT[]> = {};
      for (const [key, value] of Object.entries(list)) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          nextList[key] = value.slice(0, LOCAL_NFTS_MAX_PER_ACCOUNT);
        }
      }
      return { list: nextList };
    });
  }
}
