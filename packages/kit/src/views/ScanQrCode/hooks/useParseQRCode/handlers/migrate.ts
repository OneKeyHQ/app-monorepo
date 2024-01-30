import { deeplink as deeplinkHandler } from './deeplink';
import { EQRCodeHandlerType } from './type';

import type {
  IMigrateValue,
  IQRCodeHandler,
  IQRCodeHandlerResult,
} from './type';

export const migrate: IQRCodeHandler<IMigrateValue> = (value, options) => {
  const deepValue = deeplinkHandler(value, options);
  let result: IQRCodeHandlerResult<IMigrateValue> = null;
  if (deepValue) {
    if (deepValue.data.urlPathList?.[0] === 'migrate') {
      const migrateValue = { address: deepValue.data.urlPathList?.[1] };
      result = {
        type: EQRCodeHandlerType.MIGRATE,
        data: migrateValue,
      };
    }
  }
  return result;
};
