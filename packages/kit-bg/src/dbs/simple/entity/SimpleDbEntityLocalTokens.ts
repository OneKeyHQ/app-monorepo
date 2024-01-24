import { keyBy, merge } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAccountToken, IToken } from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ILocalTokens {
  data: Record<string, IToken>; // <networkId_tokenIdOnNetwork, token>
}

export class SimpleDbEntityLocalTokens extends SimpleDbEntityBase<ILocalTokens> {
  entityName = 'localTokens';

  override enableCache = false;

  @backgroundMethod()
  async updateTokens(tokens: IAccountToken[]) {
    const tokenMap = keyBy(tokens, '$key');
    await this.setRawData(({ rawData }) => ({
      data: merge({}, rawData?.data, tokenMap),
    }));
  }

  @backgroundMethod()
  async getToken(tokenId: string) {
    const tokenMap = (await this.getRawData())?.data;
    if (tokenMap) {
      const token = tokenMap[tokenId];
      if (token) {
        return token;
      }
    }
  }
}
