import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { AppError, ERROR_CODES } from '../../../errors';
import { SignerSoftwareBase } from '../../base/SignerSoftwareBase';
import { CLI_PASSWORD } from '../../keychain-keys';

import {
  buildBtcHdTemplate,
  resolveBtcAddressTypeInfo,
  validateBtcNetworkId,
} from './btc-path';

import type { IBtcSignerImpl } from './btc-path';
import type {
  ISignTransactionPayload,
  ISignerGetAddressOptions,
} from '../../types';

let btcScopePromise: Promise<
  InstanceType<typeof import('@onekeyhq/core/src/chains/btc').default>
> | null = null;

async function getBtcScope() {
  if (!btcScopePromise) {
    btcScopePromise = import('@onekeyhq/core/src/chains/btc').then((mod) => {
      const Scope = mod.default;
      return new Scope();
    });
  }
  return btcScopePromise;
}

export interface ISignerHdBtcConfig {
  impl: IBtcSignerImpl;
}

export class SignerHd extends SignerSoftwareBase {
  private readonly impl: IBtcSignerImpl;

  constructor(config: ISignerHdBtcConfig) {
    super();
    this.impl = config.impl;
  }

  override async getAddress(
    networkId: string,
    options?: ISignerGetAddressOptions,
  ): Promise<ICoreApiGetAddressItem> {
    validateBtcNetworkId(this.impl, networkId);
    const info = resolveBtcAddressTypeInfo(this.impl, options?.addressType);
    const hdCredential = await this.baseGetHdCredential();
    const scope = await getBtcScope();

    const result = await scope.hd.getAddressesFromHd({
      networkInfo: this.buildNetworkInfo(networkId),
      template: buildBtcHdTemplate(info),
      hdCredential,
      password: CLI_PASSWORD,
      indexes: [0],
      addressEncoding: info.addressEncoding,
    });

    return result.addresses[0];
  }

  override async signTransaction(
    payload: ISignTransactionPayload,
  ): Promise<ISignedTxPro> {
    validateBtcNetworkId(this.impl, payload.networkId);
    const info = payload.addressType
      ? resolveBtcAddressTypeInfo(this.impl, payload.addressType)
      : undefined;
    const scope = await getBtcScope();
    const hdCredential = await this.baseGetHdCredential();
    const encodedPassword = await this.baseGetEncodedPassword();

    return scope.hd.signTransaction({
      networkInfo: this.buildNetworkInfo(payload.networkId),
      password: encodedPassword,
      credentials: { hd: hdCredential },
      account: {
        address: payload.account.address,
        path: payload.account.path,
        pub: payload.account.pub,
      },
      unsignedTx: payload.unsignedTx,
      relPaths: payload.relPaths,
      btcExtraInfo: payload.btcExtraInfo,
      signOnly: payload.signOnly,
      addressEncoding: info?.addressEncoding,
    });
  }

  override async signMessage(
    _payload: ICoreApiSignMsgPayload,
  ): Promise<string> {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_COMMAND.code,
      'BTC message signing is not exposed by the CLI.',
      'Use a chain that supports message signing.',
    );
  }

  buildNetworkInfo(networkId: string) {
    return {
      networkChainCode: this.impl,
      chainId: '0',
      networkImpl: this.impl,
      networkId,
    };
  }
}
