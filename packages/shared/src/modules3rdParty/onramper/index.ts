import { OneKeyLocalError } from '../../errors';

import type {
  ICreateOnramperClientParams,
  IOnramperClient,
  IOnramperConfig,
} from './type';

export * from './type';
export * from './utils';

// The Headless SDK is native-iOS-only. Web/desktop always report unsupported so
// the branch helper routes to the existing web widget.
export function canUseHeadless(): boolean {
  return false;
}

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
