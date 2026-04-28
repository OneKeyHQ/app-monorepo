import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

interface ICustomUACallerConflictRecord {
  url: string;
  existing: string;
}

export class CustomUAScene extends BaseScene {
  // Anomaly only: callsite already set User-Agent, our injection skipped.
  // Server-side access logs are the source of truth for normal `inject` paths.
  @LogToLocal({ level: 'warn' })
  public callerConflict(record: ICustomUACallerConflictRecord) {
    return record;
  }
}
