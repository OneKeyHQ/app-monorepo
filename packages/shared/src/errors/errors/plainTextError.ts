import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { EOneKeyErrorClassNames } from '../types/errorTypes';

import { OneKeyError } from './baseErrors';

import type { IOneKeyErrorI18nInfo, IOneKeyJsError } from '../types/errorTypes';

export class OneKeyPlainTextError<
  I18nInfoT = IOneKeyErrorI18nInfo | any,
  DataT = IOneKeyJsError | any,
> extends OneKeyError<I18nInfoT, DataT> {
  override className = EOneKeyErrorClassNames.OneKeyPlainTextError;

  override name = EOneKeyErrorClassNames.OneKeyPlainTextError;

  constructor(message: string) {
    super(message);
    defaultLogger.app.error.log(message);
  }
}
