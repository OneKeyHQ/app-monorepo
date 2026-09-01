import type { AsyncStorageStatic } from '@onekeyhq/shared/src/storage/appStorageTypes';

import { SimpleDbEntityBase } from '../../../dbs/simple/base/SimpleDbEntityBase';
import { v4appStorage } from '../v4appStorage';

const SIMPLE_DB_KEY_PREFIX_V4 = 'simple_db';

export abstract class V4SimpleDbEntityBase<T> extends SimpleDbEntityBase<T> {
  override appStorage: AsyncStorageStatic = v4appStorage;

  override get entityKey() {
    return `${SIMPLE_DB_KEY_PREFIX_V4}:${this.entityName}`;
  }
}
