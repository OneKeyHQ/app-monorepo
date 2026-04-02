import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityAppCleanup extends SimpleDbEntityBase<{
  lastCleanupTime: number | undefined;
}> {
  entityName = 'appCleanup';

  override enableCache = true;
}
