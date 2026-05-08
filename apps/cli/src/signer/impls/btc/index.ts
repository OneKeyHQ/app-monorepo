import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';

import type { IBtcSignerImpl } from './btc-path';
import type { ISignerBuilders } from '../../registry';

function createBtcSignerBuilders(impl: IBtcSignerImpl): ISignerBuilders {
  return {
    hd: async () => {
      const { SignerHd } = await import('./SignerHd');
      return new SignerHd({ impl });
    },
    hw: async (device, passphraseMode) => {
      const { SignerHardware } = await import('./SignerHardware');
      return new SignerHardware({ impl, device, passphraseMode });
    },
  };
}

export const btcSignerBuilders: ISignerBuilders =
  createBtcSignerBuilders(IMPL_BTC);

export const tbtcSignerBuilders: ISignerBuilders =
  createBtcSignerBuilders(IMPL_TBTC);
