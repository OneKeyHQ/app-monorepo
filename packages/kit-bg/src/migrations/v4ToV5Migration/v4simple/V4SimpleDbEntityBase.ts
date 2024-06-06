import { SimpleDbEntityBase } from '../../../dbs/simple/base/SimpleDbEntityBase';

const SIMPLE_DB_KEY_PREFIX_V4 = 'simple_db';

export abstract class V4SimpleDbEntityBase<T> extends SimpleDbEntityBase<T> {
  override get entityKey() {
    return `${SIMPLE_DB_KEY_PREFIX_V4}:${this.entityName}`;
  }
}
