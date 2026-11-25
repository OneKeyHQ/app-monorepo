import type { IMarketHighlightAsset } from '@onekeyhq/shared/types/marketV2';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { EMarketHomeEntrySource } from '../marketHomeEntry';

export class MarketHomeScene extends BaseScene {
  /**
   * Track each entry into the Market home, whichever path switched to it.
   * Returning to the home from a page or modal above it is not an entry.
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public marketHomeView(params: {
    entrySource: EMarketHomeEntrySource;
    isFirstView: boolean;
  }) {
    return params;
  }

  // A Market Highlights carousel item, which opens the Highlights page.
  @LogToServer()
  public marketHighlightClick(params: { highlightId: string }) {
    return params;
  }

  // An asset row of a highlight card, perps included.
  @LogToServer()
  public marketHighlightAssetClick(params: {
    highlightId: string;
    assetType: IMarketHighlightAsset['type'];
  }) {
    return params;
  }

  // A source link of a highlight card. The URL and title are not reported.
  @LogToServer()
  public marketHighlightLinkClick(params: { highlightId: string }) {
    return params;
  }
}
