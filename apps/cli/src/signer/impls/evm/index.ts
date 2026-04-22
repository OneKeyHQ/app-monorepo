import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import type { ISignerRegistration } from '../../registry';

/** EVM signer registration — one lazy-loaded builder per supported wallet kind. */
export const evmSignerRegistration: ISignerRegistration = {
  impl: IMPL_EVM,
  signerBuilders: {
    hd: async () => {
      const { SignerHd } = await import('./SignerHd');
      return new SignerHd();
    },
    hw: async (device, passphraseMode) => {
      const { SignerHardware } = await import('./SignerHardware');
      return new SignerHardware({ device, passphraseMode });
    },
  },
};
