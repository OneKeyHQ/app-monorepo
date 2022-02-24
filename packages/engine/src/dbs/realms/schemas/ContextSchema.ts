import Realm from 'realm';

import { OneKeyContext } from '../../base';

class ContextSchema extends Realm.Object {
  public id!: string;

  public nextHD!: number;

  public verifyString!: string;

  public static schema: Realm.ObjectSchema = {
    name: 'Context',
    primaryKey: 'id',
    properties: {
      id: 'string',
      nextHD: 'int',
      verifyString: 'string',
    },
  };

  get internalObj(): OneKeyContext {
    return {
      id: this.id,
      nextHD: this.nextHD,
      verifyString: this.verifyString,
    };
  }
}
export { ContextSchema };
