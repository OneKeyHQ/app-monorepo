import { LogMsg, LogToLocal } from '../decorators';
import { ESceneName, type IPrimitiveValue, type IScene } from '../types';
import { getDeviceInfo } from '../utils/getDeviceInfo';

export class CommonScene implements IScene {
  getName() {
    return ESceneName.common;
  }

  @LogToLocal({ level: 'info' })
  public logDeviceInfo() {
    return LogMsg.Primitive(...getDeviceInfo());
  }

  @LogToLocal({ level: 'info' })
  public log(...args: IPrimitiveValue[]) {
    return LogMsg.Primitive(...args);
  }

  @LogToLocal({ level: 'warn' })
  public logAny(...args: any[]) {
    return LogMsg.Any(...args);
  }

  @LogToLocal({ level: 'error' })
  public test(a: string, b: number) {
    return LogMsg.Primitive(a, b);
  }

  @LogToLocal({ level: 'info' })
  public failLog(a: string, b: number) {
    return [a, b];
  }
}
