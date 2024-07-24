import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';

export class ValidationScene extends BaseScene {
  @LogToLocal({ level: 'error' })
  public failWithUnknownError({
    networkId,
    address,
    serverError,
    localError,
  }: {
    networkId: string;
    address: string;
    serverError: string;
    localError: string;
  }) {
    return [
      networkId,
      address,
      devOnlyData(serverError),
      devOnlyData(localError),
    ];
  }
}
