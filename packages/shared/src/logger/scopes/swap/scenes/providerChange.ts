import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class ProviderChangeScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public providerChange({
    changeFrom,
    changeTo,
    isClickRouter,
  }: {
    changeFrom: string;
    changeTo: string;
    isClickRouter: boolean;
  }) {
    return {
      changeFrom,
      changeTo,
      isClickRouter,
    };
  }
}
