import { keyBy, merge } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { buildAccountLocalAssetsKey } from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

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

    const key = buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });

    await this.setRawData(({ rawData }) => ({
      list: merge({}, rawData?.list, {
        [key]: nfts,
      }),
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
    const key = buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });

    return (await this.getRawData())?.list?.[key] || [];
  }
}
