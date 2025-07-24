import { EQRCodeHandlerNames } from '@onekeyhq/shared/types/qrCode';

import animation from './animation';
import bitcoin from './bitcoin';
import ethereum from './ethereum';
import lightningNetwork from './lightningNetwork';
import marketDetail from './marketDetail';
import migrate from './migrate';
import rewardCenter from './rewardCenter';
import sendProtection from './sendProtection';
import solana from './solana';
import sui from './sui';
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
  [EQRCodeHandlerNames.sendProtection]: sendProtection,
  [EQRCodeHandlerNames.rewardCenter]: rewardCenter,
  [EQRCodeHandlerNames.sui]: sui,
  [EQRCodeHandlerNames.lightningNetwork]: lightningNetwork,
};
