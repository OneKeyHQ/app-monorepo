import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PerpTokenSelectorScene extends BaseScene {
  // NOTE: eventName is methodName, keep stable for analytics
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorSearch(params: {
    query: string;
    resultCount: number;
    activeTab: 'all' | 'hip3';
    sortField: string;
    sortDirection: string;
  }) {
    return params;
  }
}
