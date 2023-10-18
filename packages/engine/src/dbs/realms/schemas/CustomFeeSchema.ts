import Realm from 'realm';

import type { BaseObject } from '../../../types/base';
import type { EIP1559Fee } from '../../../types/network';
import type { IFeeInfoUnit } from '../../../vaults/types';

class CustomFeeSchema extends Realm.Object {
  public id!: string;

  public eip1559?: boolean;

  public price1559?: Realm.Dictionary<string>;

  public price?: string;

  public isBtcForkChain?: boolean;

  public btcFee?: number;

  public feeRate?: string;

  public static schema: Realm.ObjectSchema = {
    name: 'CustomFee',
    primaryKey: 'id',
    properties: {
      id: 'string',
      eip1559: { type: 'bool', optional: true, default: false },
      price: { type: 'string', optional: true, default: '' },
      price1559: {
        type: 'dictionary',
        objectType: 'string',
        optional: true,
        default: {},
      },
      isBtcForkChain: { type: 'bool', optional: true, default: false },
      btcFee: { type: 'int', optional: true, default: 0 },
      feeRate: { type: 'string', optional: true, default: '' },
    },
  };

  get internalObj(): IFeeInfoUnit & BaseObject {
    return {
      id: this.id,
      eip1559: this.eip1559,
      price: this.price,
      price1559: this.price1559 as unknown as EIP1559Fee,
      isBtcForkChain: this.isBtcForkChain,
      btcFee: this.btcFee,
      feeRate: this.feeRate,
    };
  }
}
export { CustomFeeSchema };
