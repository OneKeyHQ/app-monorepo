import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { PageScene } from './scenes/page';

export class OnboardingScope extends BaseScope {
  protected override scopeName = EScopeName.onboarding;

  page = this.createScene('page', PageScene);
}
