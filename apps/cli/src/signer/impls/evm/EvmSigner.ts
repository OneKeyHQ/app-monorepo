import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { listEvmChains } from '../../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../../errors';
import { CLI_PASSWORD, SignerBase } from '../../base/SignerBase';

import type { ISigner } from '../../types';

// Lazy-loaded EVM scope — avoids bundling all chain SDKs
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

export class EvmSigner extends SignerBase implements ISigner {
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

  async signTransaction(payload: ICoreApiSignTxPayload): Promise<ISignedTxPro> {
    const scope = await getEvmScope();
    return scope.hd.signTransaction(payload);
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
