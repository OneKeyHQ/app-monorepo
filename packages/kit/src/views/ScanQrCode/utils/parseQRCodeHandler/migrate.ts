import { EQRCodeHandlerType } from './type';

import type {
  IMigrateValue,
  IQRCodeHandler,
  IQRCodeHandlerResult,
} from './type';

// onekey://migrate/192.168.1.2
// onekey-wallet://migrate/192.168.1.2
export const migrate: IQRCodeHandler<IMigrateValue> = (value, options) => {
  const deepValue = options?.deeplinkResult;
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
