import type { ISignerBuilders } from '../../registry';

/** SOL wallet-kind → lazy-loaded builder map. */
export const solSignerBuilders: ISignerBuilders = {
  hd: async () => {
    const { SignerHd } = await import('./SignerHd');
    return new SignerHd();
  },
  hw: async (device, passphraseMode) => {
    const { SignerHardware } = await import('./SignerHardware');
    return new SignerHardware({ device, passphraseMode });
  },
};
