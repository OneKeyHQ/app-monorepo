import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class RevokeSuggestionScene extends BaseScene {
  @LogToServer()
  public revokeSuggestionShow(params: {
    inactiveCount: number;
    riskyCount: number;
  }) {
    return params;
  }

  @LogToServer()
  public revokeSuggestionClick(params: {
    type: 'skip' | 'revoke';
    inactiveCount: number;
    riskyCount: number;
    selectedTokenCount?: number;
  }) {
    return params;
  }
}
