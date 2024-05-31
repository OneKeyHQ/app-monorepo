import { EQRCodeHandlerNames } from '../type';

import animation from './animation';
import bitcoin from './bitcoin';
import ethereum from './ethereum';
import marketDetail from './marketDetail';
import migrate from './migrate';
import solana from './solana';
import urlAccount from './urlAccount';
import walletconnect from './walletconnect';

export const PARSE_HANDLERS = {
  [EQRCodeHandlerNames.bitcoin]: bitcoin,
  [EQRCodeHandlerNames.ethereum]: ethereum,
  [EQRCodeHandlerNames.solana]: solana,
  [EQRCodeHandlerNames.walletconnect]: walletconnect,
  [EQRCodeHandlerNames.migrate]: migrate,
  [EQRCodeHandlerNames.animation]: animation,
  [EQRCodeHandlerNames.urlAccount]: urlAccount,
  [EQRCodeHandlerNames.marketDetail]: marketDetail,
};

export const PARSE_HANDLER_NAMES = {
  all: [
    EQRCodeHandlerNames.bitcoin,
    EQRCodeHandlerNames.ethereum,
    EQRCodeHandlerNames.solana,
    EQRCodeHandlerNames.walletconnect,
    EQRCodeHandlerNames.migrate,
    EQRCodeHandlerNames.animation,
    EQRCodeHandlerNames.urlAccount,
    EQRCodeHandlerNames.marketDetail,
  ],
  animation: [EQRCodeHandlerNames.animation],
  none: [],
} as Record<string, EQRCodeHandlerNames[]>;
