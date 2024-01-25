import { keyBy, merge } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ILocalTokens {
  data: Record<string, IToken>; // <networkId_tokenIdOnNetwork, token>
}

export class SimpleDbEntityLocalTokens extends SimpleDbEntityBase<ILocalTokens> {
  entityName = 'localTokens';

  override enableCache = false;

  @backgroundMethod()
  async updateTokens({
    networkId,
    tokens,
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
}
