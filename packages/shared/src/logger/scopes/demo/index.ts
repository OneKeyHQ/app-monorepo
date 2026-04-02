import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { MathScene } from './scenes/math';

export class DemoScope extends BaseScope {
  protected override scopeName = EScopeName.demo;

  math = this.createScene('math', MathScene);
}
