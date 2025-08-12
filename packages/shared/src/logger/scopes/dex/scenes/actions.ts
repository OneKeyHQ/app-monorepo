import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type {
  IDexCheckRiskParams,
  IDexCopyCAParams,
  IDexVisitSiteParams,
} from '../types';

export class ActionsScene extends BaseScene {
  /**
   * Track copying contract address
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexCopyCA(params: IDexCopyCAParams) {
    return params;
  }

  /**
   * Track viewing token risk details
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexCheckRisk(params: IDexCheckRiskParams) {
    return params;
  }

  /**
   * Track visiting external sites (official website, X/Twitter, search on X)
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexVisitSite(params: IDexVisitSiteParams) {
    return params;
  }
}
