import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

type ICardInfo = {
  hasBackup: boolean;
  isNewCard: boolean;
  serialNum: string;
  pinRetryCount: number;
} | null;

type ICardError = { code: number; message: string | null };

export class HardwareLiteCardScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public log(
    message: string,
    { cardInfo, error }: { cardInfo?: ICardInfo; error?: ICardError | null },
  ) {
    return {
      message,
      cardInfo,
      error,
    };
  }
}
