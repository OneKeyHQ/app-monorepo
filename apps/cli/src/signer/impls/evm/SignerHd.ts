import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { SignerHdBase } from '../../base/SignerHdBase';
import { CLI_PASSWORD } from '../../keychain-keys';

import { EVM_PATH_TEMPLATE, validateEvmNetworkId } from './evm-path';

import type { ISignTransactionPayload, ISigner } from '../../types';

// Lazy-loaded EVM scope — avoids bundling all chain SDKs at CLI startup.
let evmScopePromise: Promise<
  InstanceType<typeof import('@onekeyhq/core/src/chains/evm').default>
> | null = null;

async function getEvmScope() {
  if (!evmScopePromise) {
    evmScopePromise = import('@onekeyhq/core/src/chains/evm').then((mod) => {
      const Scope = mod.default;
      return new Scope();
    });
  }
  return evmScopePromise;
}

/**
 * HD (software) EVM signer. Uses the mnemonic + encryption key persisted in
 * the OS keychain. Hardware signing lives in the sibling `SignerHardware`
 * class (kit-bg convention: `KeyringHd` / `KeyringHardware`).
 */
export class SignerHd extends SignerHdBase implements ISigner {
  async getAddress(networkId: string): Promise<ICoreApiGetAddressItem> {
    validateEvmNetworkId(networkId);
    const hdCredential = await this.getHdCredential();
    const scope = await getEvmScope();

    const result = await scope.hd.getAddressesFromHd({
      networkInfo: this.buildNetworkInfo(networkId),
      template: EVM_PATH_TEMPLATE,
      hdCredential,
      password: CLI_PASSWORD,
      indexes: [0],
      addressEncoding: undefined,
    });

    return result.addresses[0];
  }

  async signTransaction(
    payload: ISignTransactionPayload,
  ): Promise<ISignedTxPro> {
    validateEvmNetworkId(payload.networkId);
    const scope = await getEvmScope();
    const hdCredential = await this.getHdCredential();
    const encodedPassword = await this.getEncodedPassword();
    const networkInfo = this.buildNetworkInfo(payload.networkId);

    return scope.hd.signTransaction({
      networkInfo,
      password: encodedPassword,
      credentials: { hd: hdCredential },
      account: {
        address: payload.account.address,
        path: payload.account.path,
        pub: payload.account.pub,
      },
      unsignedTx: payload.unsignedTx,
    });
  }

  async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const scope = await getEvmScope();
    return scope.hd.signMessage(payload);
  }

  buildNetworkInfo(networkId: string) {
    return {
      networkChainCode: 'evm',
      chainId: networkId.split('--')[1],
      networkImpl: 'evm',
      networkId,
    };
  }
}
