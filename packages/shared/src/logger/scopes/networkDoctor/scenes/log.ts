import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class LogScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public info({ info }: { info: string }) {
    return info;
  }

  @LogToLocal({ level: 'warn' })
  public warn({ info }: { info: string }) {
    return info;
  }

  @LogToLocal({ level: 'error' })
  public error({ info }: { info: string }) {
    return info;
  }
}
