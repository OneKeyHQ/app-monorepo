import { get } from 'lodash';

import type { NftObject } from '../types';
import type { SuiMoveObject } from '@mysten/sui.js';

export class Nft {
  public static isNft(obj: SuiMoveObject) {
    if (obj.fields.name && obj.fields.description && obj.fields.url) {
      return true;
    }
    if (obj.fields.metadata) {
      return true;
    }
    return false;
  }

  public static getNftObject(
    obj: SuiMoveObject,
    previousTransaction?: string,
  ): NftObject {
    return {
      objectId: get(obj, 'fields.id.id', ''),
      name: obj.fields.name,
      description: obj.fields.description,
      url: obj.fields.url,
      previousTransaction,
      objectType: obj.type,
      fields: obj.fields,
      hasPublicTransfer: obj.hasPublicTransfer ? obj.hasPublicTransfer : false,
    };
  }
}
