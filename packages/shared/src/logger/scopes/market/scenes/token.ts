import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export enum EWatchlistFrom {
  catalog = 'catalog',
  details = 'details',
  search = 'search',
}

interface IToken {
  tokenSymbol: string;
  tokenAddress?: string;
}

export class TokenScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public addToWatchList(
    token: IToken & {
      addWatchlistFrom?: EWatchlistFrom;
    },
  ) {
    return token;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public removeFromWatchlist(
    token: IToken & {
      removeWatchlistFrom?: EWatchlistFrom;
    },
  ) {
    return token;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public searchToken(
    token: IToken & {
      from?: 'recentSearch' | 'trendingList' | 'searchList';
    },
  ) {
    return token;
  }
}
