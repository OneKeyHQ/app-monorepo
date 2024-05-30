import animation from './animation';
import bitcoin from './bitcoin';
import ethereum from './ethereum';
import marketDetail from './marketDetail';
import migrate from './migrate';
import solana from './solana';
import urlAccount from './urlAccount';
import walletconnect from './walletconnect';

import type { IBaseValue, IQRCodeHandler } from '../type';

export const PARSE_HANDLERS = {
  all: {
    bitcoin,
    ethereum,
    solana,
    walletconnect,
    migrate,
    animation,
    urlAccount,
    marketDetail,
  },
  animation: {
    animation,
  },
  none: {},
} as Record<string, Record<string, IQRCodeHandler<IBaseValue>>>;
