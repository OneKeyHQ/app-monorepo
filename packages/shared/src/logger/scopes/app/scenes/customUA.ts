import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export type ICustomUADecisionKind =
  | 'inject'
  | 'skip-non-whitelist'
  | 'skip-caller-already-set'
  | 'skip-runtime-or-disabled';

interface ICustomUADecisionRecord {
  url: string;
  decision: ICustomUADecisionKind;
  injected: string | null;
  existing?: string;
}

export class CustomUAScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public decision(record: ICustomUADecisionRecord) {
    return record;
  }
}
