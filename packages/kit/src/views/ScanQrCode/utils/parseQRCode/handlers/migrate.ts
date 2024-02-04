import { EQRCodeHandlerType } from '../type';

import type { IMigrateValue, IQRCodeHandler } from '../type';

// onekey://migrate/192.168.1.2
// onekey-wallet://migrate/192.168.1.2
export const migrate: IQRCodeHandler<IMigrateValue> = (value, options) => {
  const deeplinkValue = options?.deeplinkResult;
  if (deeplinkValue) {
    if (deeplinkValue.data.urlPathList?.[0] === 'migrate') {
      const migrateValue = { address: deeplinkValue.data.urlPathList?.[1] };
      return {
        type: EQRCodeHandlerType.MIGRATE,
        data: migrateValue,
      };
    }
  }
  return null;
};
