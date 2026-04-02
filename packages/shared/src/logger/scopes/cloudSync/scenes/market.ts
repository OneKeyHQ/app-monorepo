import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

interface IWatchListItem {
  chainId: string;
  contractAddress: string;
  sortIndex?: number;
  isNative?: boolean;
}

function pickWatchListFields(item: IWatchListItem): IWatchListItem {
  const { chainId, contractAddress, sortIndex, isNative } = item;
  return { chainId, contractAddress, sortIndex, isNative };
}

export class MarketScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public addWatchList(item: IWatchListItem) {
    return pickWatchListFields(item);
  }

  @LogToLocal({ level: 'info' })
  public removeWatchList(item: IWatchListItem) {
    return pickWatchListFields(item);
  }

  @LogToConsole({ level: 'info' })
  public simpleDbAddWatchListItems({
    callerName,
    items,
  }: {
    callerName: string;
    items: IWatchListItem[];
  }) {
    return [callerName, items.map(pickWatchListFields)];
  }

  @LogToConsole({ level: 'info' })
  public simpleDbRemoveWatchListItems({
    callerName,
    items,
  }: {
    callerName: string;
    items: IWatchListItem[];
  }) {
    return [callerName, items.map(pickWatchListFields)];
  }

  @LogToConsole({ level: 'info' })
  public simpleDbClearAllWatchListItems() {
    return 'true';
  }

  @LogToLocal({ level: 'error' })
  public syncToPerpsAtomFailed(
    coin: string,
    action: 'add' | 'remove',
    error: unknown,
  ) {
    return { coin, action, error: String(error) };
  }

  @LogToLocal({ level: 'error' })
  public syncToMarketWatchListFailed(
    coin: string,
    action: 'add' | 'remove',
    error: unknown,
  ) {
    return { coin, action, error: String(error) };
  }

  @LogToLocal({ level: 'error' })
  public reconcilePerpsFavoritesFailed(error: unknown) {
    return { error: String(error) };
  }
}
