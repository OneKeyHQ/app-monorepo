import { EOneKeyErrorClassNames } from '../types/errorTypes';

import { OneKeyError } from './baseErrors';

import type { IOneKeyErrorI18nInfo, IOneKeyJsError } from '../types/errorTypes';

export class OneKeyLocalError<
  I18nInfoT = IOneKeyErrorI18nInfo | any,
  DataT = IOneKeyJsError | any,
> extends OneKeyError<I18nInfoT, DataT> {
  override className = EOneKeyErrorClassNames.OneKeyLocalError;

  override name = EOneKeyErrorClassNames.OneKeyLocalError;
}
