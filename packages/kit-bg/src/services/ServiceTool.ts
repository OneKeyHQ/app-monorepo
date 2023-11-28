import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ITool } from '@onekeyhq/shared/types';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceTool extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async demoFetchTools(): Promise<ITool[]> {
    const tools = require('../mocks/home/tools.json') as ITool[];
    return Promise.resolve(tools);
  }
}

export default ServiceTool;
