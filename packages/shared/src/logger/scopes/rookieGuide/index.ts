import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { GuideScene } from './scenes/guide';

export class RookieGuideScope extends BaseScope {
  protected override scopeName = EScopeName.rookieGuide;

  guide = this.createScene('guide', GuideScene);
}
