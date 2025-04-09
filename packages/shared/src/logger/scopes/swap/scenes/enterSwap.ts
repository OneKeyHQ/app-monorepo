import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class EnterSwapScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public enterSwap({ enterFrom }: { enterFrom: string }) {
    return {
      enterFrom,
    };
  }
}
