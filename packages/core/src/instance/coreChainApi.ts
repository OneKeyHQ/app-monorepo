import { isString } from 'lodash';

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
    implToScopeMap[scope.impl] = scope;
  }
});

export function getCoreChainApiScopeByImpl({ impl }: { impl: string }) {
  const scope = implToScopeMap[impl];
  if (!scope) {
    throw new Error(`No coreApi found for impl ${impl}`);
  }
  return scope;
}

export default coreChainApi;
