import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { listEvmChains } from '../../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../../errors';
import { CLI_PASSWORD, SignerBase } from '../../base/SignerBase';

import type { ICliSignTransactionParams, ISigner } from '../../types';

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

const EVM_TEMPLATE = "m/44'/60'/0'/0/$$INDEX$$";

/**
 * HD (software) EVM signer. Uses the mnemonic + encryption key persisted in
 * the OS keychain. Hardware signing lives in the sibling `SignerHardware`
 * class (kit-bg convention: `KeyringHd` / `KeyringHardware`).
 */
export class SignerHd extends SignerBase implements ISigner {
  async getAddress(networkId: string): Promise<ICoreApiGetAddressItem> {
    const hdCredential = await this.getHdCredential();
    const scope = await getEvmScope();

    this.validateNetworkId(networkId);

    const result = await scope.hd.getAddressesFromHd({
      networkInfo: this.buildNetworkInfo(networkId),
      template: EVM_TEMPLATE,
      hdCredential,
      password: CLI_PASSWORD,
      indexes: [0],
      addressEncoding: undefined,
    });

    return result.addresses[0];
  }

  async signTransaction(
    params: ICliSignTransactionParams,
  ): Promise<ISignedTxPro> {
    const scope = await getEvmScope();
    const hdCredential = await this.getHdCredential();
    const encodedPassword = await this.getEncodedPassword();
    const networkInfo = this.buildNetworkInfo(params.networkId);

    return scope.hd.signTransaction({
      networkInfo,
      password: encodedPassword,
      credentials: { hd: hdCredential },
      account: {
        address: params.account.address,
        path: params.account.path,
        pub: params.account.publicKey,
      },
      unsignedTx: params.unsignedTx,
    });
  }

  async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const scope = await getEvmScope();
    return scope.hd.signMessage(payload);
  }

  private validateNetworkId(networkId: string): void {
    const evmChains = listEvmChains();
    const chainConfig = evmChains.find((c) => c.networkId === networkId);
    if (!chainConfig) {
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_CHAIN.code,
        `Unsupported EVM networkId: ${networkId}`,
        `Supported: ${evmChains.map((c) => c.networkId).join(', ')}`,
      );
    }
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
