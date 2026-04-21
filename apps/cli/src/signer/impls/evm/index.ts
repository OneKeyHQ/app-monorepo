import type { IChainSignerRegistration } from '../../registry';

/**
 * EVM chain signer registration. Mirrors kit-bg's
 * `Vault.keyringMap = { hd, hw, qr, imported, watching, external }`:
 * one key per supported wallet kind, each lazy-loaded so unused code
 * paths stay out of the esbuild bundle graph.
 *
 * File / class naming (`SignerHd`, `SignerHardware`) mirrors kit-bg's
 * `impls/<chain>/KeyringHd` + `KeyringHardware` convention — chain is
 * implied by the folder, so the class name doesn't re-state it.
 */
export const evmSignerRegistration: IChainSignerRegistration = {
  impl: 'evm',
  signerBuilders: {
    hd: async () => {
      const { SignerHd } = await import('./SignerHd');
      return new SignerHd();
    },
    hardware: async (device, passphraseMode) => {
      const { SignerHardware } = await import('./SignerHardware');
      return new SignerHardware({ device, passphraseMode });
    },
  },
};
