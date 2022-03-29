import Realm from 'realm';

import { OneKeyContext } from '../../base';

class ContextSchema extends Realm.Object {
  public id!: string;

  public nextHD!: number;

  public verifyString!: string;

  public networkOrderChanged?: boolean;

  public static schema: Realm.ObjectSchema = {
    name: 'Context',
    primaryKey: 'id',
    properties: {
      id: 'string',
      nextHD: 'int',
      verifyString: 'string',
      networkOrderChanged: { type: 'bool', default: false },
    },
  };

  get internalObj(): OneKeyContext {
    return {
      id: this.id,
      nextHD: this.nextHD,
      verifyString: this.verifyString,
      networkOrderChanged: this.networkOrderChanged || false,
    };
  }
}
export { ContextSchema };
