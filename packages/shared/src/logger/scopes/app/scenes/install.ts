import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';

export class InstallScene extends BaseScene {
  @LogToLocal({ level: 'error' })
  public test(a: string, b: number) {
    return [a, b];
  }

  @LogToLocal({ level: 'info' })
  public sum(a: number, b: number) {
    return [a, b];
  }
}
