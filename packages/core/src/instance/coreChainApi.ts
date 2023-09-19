import { isString } from 'lodash';

import { CoreChainApiHub } from '../base/CoreChainApiHub';
import { CoreChainScopeBase } from '../base/CoreChainScopeBase';

const coreChainApi = new CoreChainApiHub();

Object.keys(coreChainApi).forEach((key) => {
  // @ts-ignore
  const scope = coreChainApi[key] as CoreChainScopeBase | undefined;
  if (
    scope &&
    scope instanceof CoreChainScopeBase &&
    isString(scope?.scopeName)
  ) {
    scope.scopeName = key;
  }
});

export default coreChainApi;
