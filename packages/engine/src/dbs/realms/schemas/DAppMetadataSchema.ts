import Realm from 'realm';

import type { BaseObject } from '../../../types/base';
import type { DAppMetadata } from '../../../types/dapp';

class DAppMetadataSchema extends Realm.Object {
  public id!: string;

  public name?: string;

  public icon?: string;

  public static schema: Realm.ObjectSchema = {
    name: 'DAppMetadata',
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: { type: 'string', optional: true, default: '' },
      icon: { type: 'string', optional: true, default: '' },
    },
  };

  get internalObj(): DAppMetadata & BaseObject {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
    };
  }
}
export { DAppMetadataSchema };
