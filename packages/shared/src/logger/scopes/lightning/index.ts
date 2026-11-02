import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { SparkScene } from './scenes/spark';

export class LightningScope extends BaseScope {
  protected override scopeName = EScopeName.lightning;

  spark = this.createScene('spark', SparkScene);
}
