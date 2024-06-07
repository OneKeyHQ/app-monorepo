import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';
import type {
  IBaseConnectedSite,
  ICreateSignedMessageParams,
  ICreateSignedTransactionParams,
} from '@onekeyhq/shared/types/signatureRecord';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';

export class NormalScene extends BaseScene {
  @LogToLocal({ level: 'error' })
  public failToCreateSignedTransaction({
    params,
    error,
  }: {
    params: ICreateSignedTransactionParams;
    error: string;
  }) {
    return [params, devOnlyData(error)];
  }

  @LogToLocal({ level: 'error' })
  public failToCreateSignedMessage({
    params,
    error,
  }: {
    params: ICreateSignedMessageParams;
    error: string;
  }) {
    return [params, devOnlyData(error)];
  }

  @LogToLocal({ level: 'error' })
  public failToAddConnectedSite({
    params,
    error,
  }: {
    params: IBaseConnectedSite;
    error: string;
  }) {
    return [params, devOnlyData(error)];
  }
}
