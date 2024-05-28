import animation from './animation';
import bitcoin from './bitcoin';
import ethereum from './ethereum';
import migrate from './migrate';
import solana from './solana';
import urlAccount from './urlAccount';
import walletconnect from './walletconnect';

import type {
  IBaseValue,
  IQRCodeHandler,
  IQRCodeParseHandlerListScene,
} from '../type';

export function getParseHandlerListWithScene(
  type: IQRCodeParseHandlerListScene,
) {
  switch (type) {
    case 'all':
      return {
        bitcoin,
        ethereum,
        solana,
        walletconnect,
        migrate,
        animation,
        urlAccount,
      } as Record<string, IQRCodeHandler<IBaseValue>>;
    case 'animation': {
      return {
        animation,
      } as Record<string, IQRCodeHandler<IBaseValue>>;
    }
    case 'none': {
      return {};
    }
    default:
      return {};
  }
}
