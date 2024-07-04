import { isString } from 'lodash';

import {
  IMPL_BTC,
  IMPL_CKB,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { CoreChainApiHub } from '../base/CoreChainApiHub';
import { CoreChainScopeBase } from '../base/CoreChainScopeBase';

const coreChainApi = new CoreChainApiHub();

const implToScopeMap: Partial<Record<string, CoreChainScopeBase>> = {};

Object.keys(coreChainApi).forEach((key) => {
  // @ts-ignore
  const scope = coreChainApi[key] as CoreChainScopeBase | undefined;
  if (
    scope &&
    scope instanceof CoreChainScopeBase &&
    isString(scope?.scopeName)
  ) {
    scope.scopeName = key;
    if (!scope.impl) {
      throw new Error(`CoreChainScope must have impl: ${key}`);
    }
    if (scope.impl !== key && scope.impl !== IMPL_CKB) {
      throw new Error(
        `CoreChainApiHub key must be the same as impl: ${scope.impl}, ${key}`,
      );
    }
    implToScopeMap[scope.impl] = scope;
  }
});

export function getCoreChainApiScopeByImpl({ impl }: { impl: string }) {
  let scope = implToScopeMap[impl];
  if (!scope) {
    if (impl === IMPL_TBTC) {
      scope = implToScopeMap[IMPL_BTC];
    }
  }
  if (!scope) {
    throw new Error(`No coreApi found for impl ${impl}`);
  }
  return scope;
}

export default coreChainApi;
