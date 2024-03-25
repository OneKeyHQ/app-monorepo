import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';

export class MathScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public sum(a: number, b: number) {
    return a + b;
  }

  @LogToLocal({ level: 'info' })
  public obj(a: number, b: number) {
    return { a, b };
  }

  @LogToLocal({ level: 'info' })
  public arr(a: number, b: number) {
    return [a, b];
  }
}
