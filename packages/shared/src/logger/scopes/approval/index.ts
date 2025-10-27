import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { RevokeSuggestionScene } from './scenes/revokeSuggestion';

export class ApprovalScope extends BaseScope {
  protected override scopeName = EScopeName.approval;

  revokeSuggestion = this.createScene(
    'revokeSuggestion',
    RevokeSuggestionScene,
  );
}
