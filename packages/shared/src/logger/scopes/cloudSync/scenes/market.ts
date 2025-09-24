import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

export class MarketScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public addWatchList(item: {
    chainId: string;
    contractAddress: string;
    sortIndex?: number;
    isNative?: boolean;
  }) {
    const { chainId, contractAddress, sortIndex, isNative } = item;
    return { chainId, contractAddress, sortIndex, isNative };
  }

  @LogToLocal({ level: 'info' })
  public removeWatchList(item: {
    chainId: string;
    contractAddress: string;
    sortIndex?: number;
    isNative?: boolean;
  }) {
    const { chainId, contractAddress, sortIndex, isNative } = item;
    return { chainId, contractAddress, sortIndex, isNative };
  }

  @LogToConsole({ level: 'info' })
  public simpleDbAddWatchListItems({
    callerName,
    items,
  }: {
    callerName: string;
    items: {
      chainId: string;
      contractAddress: string;
      sortIndex?: number;
      isNative?: boolean;
    }[];
  }) {
    return [
      callerName,
      items.map((item) => {
        const { chainId, contractAddress, sortIndex, isNative } = item;
        return { chainId, contractAddress, sortIndex, isNative };
      }),
    ];
  }

  @LogToConsole({ level: 'info' })
  public simpleDbRemoveWatchListItems({
    callerName,
    items,
  }: {
    callerName: string;
    items: {
      chainId: string;
      contractAddress: string;
      sortIndex?: number;
      isNative?: boolean;
    }[];
  }) {
    return [
      callerName,
      items.map((item) => {
        const { chainId, contractAddress, sortIndex, isNative } = item;
        return { chainId, contractAddress, sortIndex, isNative };
      }),
    ];
  }

  @LogToConsole({ level: 'info' })
  public simpleDbClearAllWatchListItems() {
    return 'true';
  }
}
