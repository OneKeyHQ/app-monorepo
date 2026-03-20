import CoreChainEvm from '@onekeyhq/core/src/chains/evm';
import { revealableSeedFromMnemonic } from '@onekeyhq/core/src/secret';
import type { ICoreApiGetAddressItem } from '@onekeyhq/core/src/types';

import { CHAINS } from '../config';
import { decrypt, secureWipe } from '../core/crypto-utils';
import { AppError, ERROR_CODES } from '../errors';
import { KeychainStorage } from '../infra/keychain-storage';

import type { ISigner } from './types';

const CLI_PASSWORD = 'onekey';
const WALLET_NAME = 'default';
const MNEMONIC_KEY = `wallet:${WALLET_NAME}/mnemonic`;
const ENCRYPTION_KEY = `wallet:${WALLET_NAME}/encryption-key`;

// Direct EVM scope instance — avoids importing CoreChainApiHub which
// pulls in ALL chain SDKs (btc, sol, cosmos, etc.) and bloats the bundle.
const evmScope = new CoreChainEvm();

export class KeychainSigner implements ISigner {
  private keychain = new KeychainStorage();

  async getAddress(
    impl: string,
    networkId: string,
  ): Promise<ICoreApiGetAddressItem> {
    const hdCredential = await this.getHdCredential();

    const chainConfig = Object.values(CHAINS).find(
      (c) => c.networkId === networkId,
    );
    if (!chainConfig) {
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_CHAIN.code,
        `Unsupported networkId: ${networkId}`,
        `Supported: ${Object.values(CHAINS)
          .map((c) => c.networkId)
          .join(', ')}`,
      );
    }

    if (impl !== 'evm') {
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_CHAIN.code,
        `Unsupported chain impl: ${impl}`,
        'Currently only EVM chains are supported',
      );
    }

    const result = await evmScope.hd.getAddressesFromHd({
      networkInfo: {
        networkChainCode: impl,
        chainId: networkId.split('--')[1],
        networkImpl: impl,
        networkId,
      },
      template: "m/44'/60'/0'/0/$$INDEX$$",
      hdCredential,
      password: CLI_PASSWORD,
      indexes: [0],
      addressEncoding: undefined,
    });

    return result.addresses[0];
  }

  private async getHdCredential(): Promise<string> {
    const encryptionKeyBuf = await this.keychain.get(ENCRYPTION_KEY);
    if (!encryptionKeyBuf) {
      throw new AppError(
        ERROR_CODES.AUTH_NO_WALLET.code,
        'No wallet found. Import a wallet first.',
        'Run: onekey import --mnemonic',
      );
    }

    const encryptedMnemonic = await this.keychain.get(MNEMONIC_KEY);
    if (!encryptedMnemonic) {
      throw new AppError(
        ERROR_CODES.AUTH_NO_WALLET.code,
        'No wallet found. Import a wallet first.',
        'Run: onekey import --mnemonic',
      );
    }

    const encryptionKey = encryptionKeyBuf.toString('utf-8');
    let mnemonicBuf: Buffer | null = null;

    try {
      mnemonicBuf = await decrypt(encryptedMnemonic, encryptionKey);
      const mnemonic = mnemonicBuf.toString('utf-8');
      return await revealableSeedFromMnemonic(mnemonic, CLI_PASSWORD);
    } finally {
      if (mnemonicBuf) secureWipe(mnemonicBuf);
      secureWipe(encryptionKeyBuf);
    }
  }
}

export const KEYCHAIN_MNEMONIC_KEY = MNEMONIC_KEY;
export const KEYCHAIN_ENCRYPTION_KEY = ENCRYPTION_KEY;
