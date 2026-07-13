import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { ILoggerUtmParams } from '../../../utmParams';

export class RouterScene extends BaseScene {
  @LogToLocal()
  public switchTab(route: string) {
    return { route };
  }

  @LogToLocal()
  public switchTabDone(route: string) {
    return { route };
  }

  @LogToLocal()
  public pushRoute(params: {
    action: string;
    address?: string;
    routeName?: string;
  }) {
    return params;
  }

  @LogToLocal()
  public navState(params: {
    action: string;
    focusedTab?: string;
    stackDepth?: number;
    topRoute?: string;
  }) {
    return params;
  }

  @LogToLocal()
  public navStateChange(params: {
    tab: string;
    stackDepth: number;
    topRoute?: string;
  }) {
    return params;
  }

  @LogToLocal()
  public pageMounted(pageName: string) {
    return { pageName };
  }

  @LogToServer()
  public utmParamsCaptured(params: ILoggerUtmParams) {
    return params;
  }
}
