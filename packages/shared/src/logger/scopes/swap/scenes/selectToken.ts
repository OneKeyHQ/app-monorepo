import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class SelectTokenScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public selectToken({ selectFrom }: { selectFrom: string }) {
    return {
      selectFrom,
    };
  }
}
