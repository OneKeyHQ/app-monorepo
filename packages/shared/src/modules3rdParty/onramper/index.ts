import { OneKeyLocalError } from '../../errors';

import type {
  ICreateOnramperClientParams,
  IOnramperClient,
  IOnramperConfig,
} from './type';

export * from './type';
export * from './quotePricing';
export * from './orderStatus';
export * from './utils';
export { canUseHeadless } from './canUseHeadless';

// Never called on web (the page is native-only); present so the shared import
// resolves on every platform.
export function getOnramperConfig(): IOnramperConfig {
  return { apiKey: '', clientId: '', environment: 'development' };
}

export function createOnramperClient(
  _params: ICreateOnramperClientParams,
): IOnramperClient {
  throw new OneKeyLocalError(
    'Onramper Headless SDK is only available on native iOS devices',
  );
}
