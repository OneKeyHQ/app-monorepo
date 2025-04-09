import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class CleanSwapOrderScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public cleanSwapOrder({ cleanFrom }: { cleanFrom: string }) {
    return {
      cleanFrom,
    };
  }
}
