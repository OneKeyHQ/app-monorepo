import { LogToLocal } from '../decorators';
import { ESceneName, type IScene } from '../types';
import { getDeviceInfo } from '../utils';

export class CommonScene implements IScene {
  getName() {
    return ESceneName.common;
  }

  @LogToLocal({ level: 'info' })
  public logDeviceInfo() {
    return getDeviceInfo();
  }

  @LogToLocal({ level: 'error' })
  public test(a: string, b: number) {
    return [a, b];
  }

  @LogToLocal({ level: 'info' })
  public sum(a: number, b: number) {
    return [a, b];
  }
}
