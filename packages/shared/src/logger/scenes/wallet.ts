import { LogToLocal } from '../decorators';
import { ESceneName, type IScene } from '../types';

export class WalletScene implements IScene {
  getName() {
    return ESceneName.wallet;
  }

  @LogToLocal({ level: 'info' })
  public sayHello(a: string, b: number) {
    return [a, b];
  }
}
