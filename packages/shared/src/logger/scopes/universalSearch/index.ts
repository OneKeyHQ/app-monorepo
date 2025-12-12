import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { SearchScene } from './scenes/search';

export class UniversalSearchScope extends BaseScope {
  protected override scopeName = EScopeName.universalSearch;

  search = this.createScene('search', SearchScene);
}

export * from './types';
