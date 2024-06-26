import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';

export class BackgroundScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public logProxyMethodCall(name: string) {
    return `Proxy method call: ${name}`;
  }
}
