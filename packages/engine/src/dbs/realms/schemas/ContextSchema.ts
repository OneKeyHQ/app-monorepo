import Realm from 'realm';

import type { OneKeyContext } from '../../base';

class ContextSchema extends Realm.Object {
  public id!: string;

  public nextHD!: number;

  public verifyString!: string;

  public networkOrderChanged?: boolean;

  public pendingWallets?: Realm.Set<string>;

  public backupUUID!: string;

  public static schema: Realm.ObjectSchema = {
    name: 'Context',
    primaryKey: 'id',
    properties: {
      id: 'string',
      nextHD: 'int',
      verifyString: 'string',
      networkOrderChanged: { type: 'bool', default: false },
      pendingWallets: { type: 'string<>', default: [] },
      backupUUID: { type: 'string', default: '' },
    },
  };

  get internalObj(): OneKeyContext {
    return {
      id: this.id,
      nextHD: this.nextHD,
      verifyString: this.verifyString,
      networkOrderChanged: this.networkOrderChanged || false,
      pendingWallets: (this.pendingWallets || []).map((walletId) => walletId),
      backupUUID: this.backupUUID,
    };
  }
}
export { ContextSchema };
