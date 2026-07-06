import { EQRCodeHandlerNames } from '@onekeyhq/shared/types/qrCode';

import type { IBaseValue, IQRCodeHandler } from '../type';

type IQRCodeHandlerLoader = () => Promise<IQRCodeHandler<IBaseValue>>;

async function loadHandler<T extends IBaseValue>(
  loader: () => Promise<{ default: IQRCodeHandler<T> }>,
): Promise<IQRCodeHandler<IBaseValue>> {
  return (await loader()).default as IQRCodeHandler<IBaseValue>;
}

export const PARSE_HANDLER_LOADERS: Record<
  EQRCodeHandlerNames,
  IQRCodeHandlerLoader
> = {
  [EQRCodeHandlerNames.bitcoin]: () => loadHandler(() => import('./bitcoin')),
  [EQRCodeHandlerNames.ethereum]: () => loadHandler(() => import('./ethereum')),
  [EQRCodeHandlerNames.solana]: () => loadHandler(() => import('./solana')),
  [EQRCodeHandlerNames.walletconnect]: () =>
    loadHandler(() => import('./walletconnect')),
  [EQRCodeHandlerNames.migrate]: () => loadHandler(() => import('./migrate')),
  [EQRCodeHandlerNames.animation]: () =>
    loadHandler(() => import('./animation')),
  [EQRCodeHandlerNames.urlAccount]: () =>
    loadHandler(() => import('./urlAccount')),
  [EQRCodeHandlerNames.marketDetail]: () =>
    loadHandler(() => import('./marketDetail')),
  [EQRCodeHandlerNames.sendProtection]: () =>
    loadHandler(() => import('./sendProtection')),
  [EQRCodeHandlerNames.updatePreview]: () =>
    loadHandler(() => import('./updatePreview')),
  [EQRCodeHandlerNames.primeTransfer]: () =>
    loadHandler(() => import('./primeTransfer')),
  [EQRCodeHandlerNames.rewardCenter]: () =>
    loadHandler(() => import('./rewardCenter')),
  [EQRCodeHandlerNames.sui]: () => loadHandler(() => import('./sui')),
  [EQRCodeHandlerNames.lightningNetwork]: () =>
    loadHandler(() => import('./lightningNetwork')),
};

export function getParseHandler(handlerName: EQRCodeHandlerNames) {
  return PARSE_HANDLER_LOADERS[handlerName]?.();
}
