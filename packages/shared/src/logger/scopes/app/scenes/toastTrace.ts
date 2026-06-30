import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class ToastTraceScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public info({ info }: { info: string }) {
    return info;
  }
}
