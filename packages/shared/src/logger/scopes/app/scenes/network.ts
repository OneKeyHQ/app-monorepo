import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';

export class NetworkScene extends BaseScene {
  @LogToLocal({ level: 'debug' })
  public call(
    requestType: string,
    method = 'GET',
    path = '/',
    requestId?: string,
  ) {
    return `${requestType}:${method}:${path}, requestId: ${requestId || ''}`;
  }
}
