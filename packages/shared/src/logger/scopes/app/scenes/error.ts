import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

import type { Stacktrace } from '@sentry/core';

export class ErrorScene extends BaseScene {
  @LogToLocal()
  public log(errorMessage: string, stacktrace?: Stacktrace) {
    return {
      errorMessage,
      stacktrace: stacktrace ? JSON.stringify(stacktrace) : '',
    };
  }
}
