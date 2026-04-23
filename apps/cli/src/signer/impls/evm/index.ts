import type { ISignerBuilders } from '../../registry';

/** EVM wallet-kind → lazy-loaded builder map. */
export const evmSignerBuilders: ISignerBuilders = {
  hd: async () => {
    const { SignerHd } = await import('./SignerHd');
    return new SignerHd();
  },
  hw: async (device, passphraseMode) => {
    const { SignerHardware } = await import('./SignerHardware');
    return new SignerHardware({ device, passphraseMode });
  },
};
