import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';

import { SignerSoftwareBase } from '../../base/SignerSoftwareBase';
import { CLI_PASSWORD } from '../../keychain-keys';

import { SOL_PATH_TEMPLATE, validateSolNetworkId } from './sol-path';

import type {
  ISignTransactionPayload,
  ISignerGetAddressOptions,
} from '../../types';

// Lazy-loaded SOL scope — avoids bundling the @solana/web3.js stack at CLI
// startup when the user is operating on EVM/BTC.
let solScopePromise: Promise<
  InstanceType<typeof import('@onekeyhq/core/src/chains/sol').default>
> | null = null;

async function getSolScope() {
  if (!solScopePromise) {
    solScopePromise = import('@onekeyhq/core/src/chains/sol').then((mod) => {
      const Scope = mod.default;
      return new Scope();
    });
  }
  return solScopePromise;
}

/**
 * HD (software) SOL signer. Mirrors EVM/BTC pattern: fetches the encrypted
 * mnemonic from the Bot Wallet vault, hands it to `@onekeyhq/core/src/chains/sol`
 * for ed25519 derivation + signing, returns the result. SOL message signing
 * is delegated through the same scope (EMessageTypesCommon.SIGN_MESSAGE +
 * EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE are handled by core).
 */
export class SignerHd extends SignerSoftwareBase {
  override async getAddress(
    networkId: string,
    _options?: ISignerGetAddressOptions,
  ): Promise<ICoreApiGetAddressItem> {
    validateSolNetworkId(networkId);
    const hdCredential = await this.baseGetHdCredential();
    const scope = await getSolScope();

    const result = await scope.hd.getAddressesFromHd({
      networkInfo: this.buildNetworkInfo(networkId),
      template: SOL_PATH_TEMPLATE,
      hdCredential,
      password: CLI_PASSWORD,
      indexes: [0],
      addressEncoding: undefined,
    });

    return result.addresses[0];
  }

  override async signTransaction(
    payload: ISignTransactionPayload,
  ): Promise<ISignedTxPro> {
    validateSolNetworkId(payload.networkId);
    const scope = await getSolScope();
    const hdCredential = await this.baseGetHdCredential();
    const encodedPassword = await this.baseGetEncodedPassword();
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

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const scope = await getSolScope();
    return scope.hd.signMessage(payload);
  }

  buildNetworkInfo(networkId: string) {
    return {
      networkChainCode: IMPL_SOL,
      chainId: networkId.split('--')[1] ?? '',
      networkImpl: IMPL_SOL,
      networkId,
    };
  }
}
