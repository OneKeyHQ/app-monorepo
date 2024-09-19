import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class ParseQrCodeScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public parsedQrCode(parseResult: string) {
    return { parseResult };
  }
}
