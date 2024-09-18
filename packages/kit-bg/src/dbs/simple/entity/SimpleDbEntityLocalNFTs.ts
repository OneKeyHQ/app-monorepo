import { keyBy, merge } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import type { IToken } from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ILocalNFTs {
  data: Record<string, IAccountNFT>; // <networkId_tokenIdOnNetwork, token>
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
    tokens: IToken[];
  }) {
    const tokenMap = keyBy(
      tokens.map((token) => ({
        ...token,
        '$key': accountUtils.buildLocalTokenId({
          networkId,
          tokenIdOnNetwork: token.address,
        }),
      })),
      '$key',
    );
    await this.setRawData(({ rawData }) => ({
      data: merge({}, rawData?.data, tokenMap),
    }));
  }

  @backgroundMethod()
  async getToken({
    networkId,
    tokenIdOnNetwork,
  }: {
    networkId: string;
    tokenIdOnNetwork: string;
  }) {
    const tokenId = accountUtils.buildLocalTokenId({
      networkId,
      tokenIdOnNetwork,
    });
    const tokenMap = (await this.getRawData())?.data;
    if (tokenMap) {
      const token = tokenMap[tokenId];
      if (token) {
        return token;
      }
    }
  }

  @backgroundMethod()
  async clearTokens() {
    await this.setRawData({ data: {} });
  }
}
