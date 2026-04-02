import { BaseScene } from '../../../base/baseScene';
import { LogToConsole } from '../../../base/decorators';

export class EventBusScene extends BaseScene {
  @LogToConsole()
  public emitToSelf(params: { eventName: string }) {
    return [params.eventName];
  }
}
