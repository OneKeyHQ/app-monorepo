/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import bs58 from 'bs58';
import { isArray } from 'lodash';
import isString from 'lodash/isString';

import {
  OffchainMessage,
  classifyOffchainMessageVersion,
} from '@onekeyhq/core/src/chains/sol/sdkSol/OffchainMessage';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EMessageTypesCommon,
  EMessageTypesSolana,
} from '@onekeyhq/shared/types/message';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

type ISolanaSendOptions = {
  /** disable transaction verification step */
  skipPreflight?: boolean;
  /** preflight commitment level */
  preflightCommitment?: string;
  /** Maximum number of times for the RPC node to retry sending the transaction to the leader. */
  maxRetries?: number;
};

// Decoding failures are dapp input errors: bs58 and the offchain message encoder throw their
// own error types, which would reach the dapp instead of a JSON-RPC invalidParams.
function decodeBase58Message(message: string) {
  try {
    return bs58.decode(message);
  } catch {
    throw web3Errors.rpc.invalidParams(
      'message must be a base58 encoded string',
    );
  }
}

function decodeRequiredSigners(requiredSigners: string[]): Uint8Array[] {
  const decoded: Uint8Array[] = [];
  for (const signer of requiredSigners) {
    let bytes: Uint8Array | undefined;
    try {
      bytes = bs58.decode(signer);
    } catch {
      bytes = undefined;
    }
    if (!bytes || bytes.length !== 32) {
      throw web3Errors.rpc.invalidParams(
        'requiredSigners must be base58 encoded 32-byte public keys',
      );
    }
    decoded.push(bytes);
  }
  return decoded;
}

// The spec sets no ceiling; this only keeps a dapp from handing the signer an unbounded body.
const MAX_OFFCHAIN_MESSAGE_V1_BYTES = 1024 * 1024;
const MAX_OFFCHAIN_MESSAGE_V1_SIGNERS = 255;

function buildOffchainMessageV1Bytes(
  message: string,
  requiredSigners: string[],
): Uint8Array {
  const decodedSigners = decodeRequiredSigners(requiredSigners);
  try {
    return OffchainMessage.createOffChainMessageV1Bytes({
      message,
      requiredSigners: decodedSigners,
    });
  } catch (error) {
    // Uniqueness and the 255 signer cap are enforced by the encoder, so they surface here.
    throw web3Errors.rpc.invalidParams(
      error instanceof Error
        ? error.message
        : 'invalid offchain message params',
    );
  }
}

@backgroundClass()
class ProviderApiSolana extends ProviderApiBase {
  public providerName = IInjectedProviderNames.solana;

  _getConnectedAccountsPublicKey = async (
    request: IJsBridgeMessagePayload,
  ): Promise<{ publicKey: string }[]> => {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(
      accountsInfo.map((i) => ({ publicKey: i.account.address })),
    );
  };

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: await this._getConnectedAccountsPublicKey({
            origin,
            scope: this.providerName,
          }),
        },
      };
      return result;
    };

    info.send(data, info.targetOrigin);
  }

  public notifyDappChainChanged() {
    // noop
  }

  @providerApiMethod()
  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    const { data } = request;
    const { accountInfo: { networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const rpcRequest = data as IJsonRpcRequest;

    console.log(`${this.providerName} RpcCall=====>>>> : BgApi:`, request);

    const [result] = await this.backgroundApi.serviceDApp.proxyRPCCall({
      networkId: networkId ?? '',
      request: rpcRequest,
      origin: request.origin ?? '',
    });

    return result;
  }

  // ----------------------------------------------

  @providerApiMethod()
  public disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    void this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: 'injectedProvider',
    });
    console.log('solana disconnect', origin);
  }

  @providerApiMethod()
  public async signTransaction(
    request: IJsBridgeMessagePayload,
    params: { message: string },
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    if (typeof params.message !== 'string') {
      throw web3Errors.rpc.invalidInput();
    }

    const rawTx =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        request,
        encodedTx: params.message,
        signOnly: true,
      });
    // Signed transaction is base64 encoded, inpage provider expects base58.
    return bs58.encode(Buffer.from(rawTx.rawTx, 'base64'));
  }

  @providerApiMethod()
  public async signAllTransactions(
    request: IJsBridgeMessagePayload,
    params: { message: string[] },
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { message: txsToBeSigned } = params;

    if (
      !isArray(txsToBeSigned) ||
      txsToBeSigned.length === 0 ||
      !txsToBeSigned.every(isString)
    ) {
      throw web3Errors.rpc.invalidInput();
    }

    console.log('solana signAllTransactions', request, params);

    const ret: string[] = [];
    for (const tx of txsToBeSigned) {
      const signedTx = await this.signTransaction(request, { message: tx });
      ret.push(signedTx);
    }
    return ret;
  }

  @providerApiMethod()
  public async signAndSendTransaction(
    request: IJsBridgeMessagePayload,
    params: { message: string; options?: ISolanaSendOptions },
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { message } = params;

    if (!isString(message)) {
      throw web3Errors.rpc.invalidInput();
    }

    const { accountInfo: { accountId, networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const txid =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        request,
        encodedTx: message,
        signOnly: false,
      });
    console.log('solana signTransaction', request, params);
    return {
      signature: txid.txid,
      publicKey: address ?? '',
    };
  }

  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: {
      message: string;
      display?: 'hex' | 'utf8';
    },
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { message, display = 'utf8' } = params;

    const { accountInfo: { accountId, networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    if (!isString(message) || !['utf8', 'hex'].includes(display)) {
      throw web3Errors.rpc.invalidInput();
    }

    console.log('solana signMessage', request, params);

    const signature = await this.backgroundApi.serviceDApp.openSignMessageModal(
      {
        request,
        unsignedMessage: {
          type: EMessageTypesCommon.SIGN_MESSAGE,
          message: decodeBase58Message(message).toString(),
        },
        networkId: networkId ?? '',
        accountId: accountId ?? '',
      },
    );

    return { signature, publicKey: address ?? '' };
  }

  @providerApiMethod()
  public async solSignOffchainMessage(
    request: IJsBridgeMessagePayload,
    params:
      | {
          /** Version 0. `message` is base58 encoded bytes. */
          version?: 0;
          message: string;
          applicationDomain?: string;
        }
      | {
          /**
           * Version 1 of the Solana offchain message spec.
           * https://github.com/solana-foundation/SRFCs/discussions/3
           * `message` is the UTF-8 body verbatim; the wallet builds the preamble.
           */
          version: 1;
          message: string;
          /** Base58 encoded 32-byte signer public keys. */
          requiredSigners: string[];
        },
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const { accountInfo: { accountId, networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const versionKind = classifyOffchainMessageVersion(params.version);
    if (versionKind === 'unsupported') {
      throw web3Errors.rpc.invalidParams(
        'unsupported offchain message version',
      );
    }

    // classifyOffchainMessageVersion decides what is supported; this reads the
    // discriminant, which is what narrows the params to their version 1 shape.
    if (params.version === 1) {
      const { message, requiredSigners } = params;

      if (!isString(message) || message.length === 0) {
        throw web3Errors.rpc.invalidParams(
          'message must be a non-empty UTF-8 string',
        );
      }
      if (!isArray(requiredSigners) || requiredSigners.length === 0) {
        throw web3Errors.rpc.invalidParams(
          'requiredSigners must be a non-empty array',
        );
      }
      if (requiredSigners.length > MAX_OFFCHAIN_MESSAGE_V1_SIGNERS) {
        throw web3Errors.rpc.invalidParams(
          `requiredSigners must hold at most ${MAX_OFFCHAIN_MESSAGE_V1_SIGNERS} public keys`,
        );
      }
      if (Buffer.byteLength(message, 'utf8') > MAX_OFFCHAIN_MESSAGE_V1_BYTES) {
        throw web3Errors.rpc.invalidParams(
          `message must be at most ${MAX_OFFCHAIN_MESSAGE_V1_BYTES} bytes`,
        );
      }
      // Never trust the dapp. The spec requires requiredSigners to "contain the public key of
      // `account`", so a missing address means the requirement cannot be verified and the
      // request must be rejected rather than signed.
      if (!address || !requiredSigners.includes(address)) {
        throw web3Errors.rpc.invalidParams(
          'requiredSigners must contain the public key of the connected account',
        );
      }

      // Built here as well as on the signing path. Both go through the same encoder, so the
      // bytes returned to the dapp are exactly the bytes that were signed.
      const signedOffchainMessage = buildOffchainMessageV1Bytes(
        message,
        requiredSigners,
      );

      // The air-gap data types only implement version 0. Reject QR requests before opening a
      // confirmation screen; OneKey hardware handles version 1 in its Solana keyring.
      if (accountId && accountUtils.isQrAccount({ accountId })) {
        throw web3Errors.rpc.methodNotSupported(
          'Version 1 Solana offchain messages are not supported by QR wallets',
        );
      }

      const signature =
        await this.backgroundApi.serviceDApp.openSignMessageModal({
          request,
          unsignedMessage: {
            type: EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE,
            // UTF-8 body verbatim, not base58: version 1 leaves encoding to the wallet.
            message,
            payload: {
              version: 1,
              requiredSigners,
            },
          },
          networkId: networkId ?? '',
          accountId: accountId ?? '',
        });

      return {
        signature,
        publicKey: address ?? '',
        signedOffchainMessage: bs58.encode(signedOffchainMessage),
      };
    }

    const { message, version, applicationDomain } = params;

    const signature = await this.backgroundApi.serviceDApp.openSignMessageModal(
      {
        request,
        unsignedMessage: {
          type: EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE,
          message: decodeBase58Message(message).toString(),
          payload: {
            version: version ?? 0,
            applicationDomain,
          },
        },
        networkId: networkId ?? '',
        accountId: accountId ?? '',
      },
    );

    return { signature, publicKey: address ?? '' };
  }

  @providerApiMethod()
  public async connect(
    request: IJsBridgeMessagePayload,
    params?: { onlyIfTrusted: boolean },
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { onlyIfTrusted = false } = params || {};

    let publicKey = (await this._getConnectedAccountsPublicKey(request))[0];
    if (!publicKey && !onlyIfTrusted) {
      await this.backgroundApi.serviceDApp.openConnectionModal(request);
      publicKey = (await this._getConnectedAccountsPublicKey(request))[0];
    }

    if (!publicKey) {
      throw web3Errors.provider.userRejectedRequest();
    }

    return publicKey;
  }
}

export default ProviderApiSolana;
