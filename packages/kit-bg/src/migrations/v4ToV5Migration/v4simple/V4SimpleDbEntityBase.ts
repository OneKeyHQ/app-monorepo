import { SimpleDbEntityBase } from '../../../dbs/simple/base/SimpleDbEntityBase';
import { v4appStorage } from '../v4appStorage';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

const SIMPLE_DB_KEY_PREFIX_V4 = 'simple_db';

export abstract class V4SimpleDbEntityBase<T> extends SimpleDbEntityBase<T> {
  override appStorage: AsyncStorageStatic = v4appStorage;

  override get entityKey() {
    return `${SIMPLE_DB_KEY_PREFIX_V4}:${this.entityName}`;
  }
}
