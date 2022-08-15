/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';
import isArray from 'lodash/isArray';
import isString from 'lodash/isString';

import { wait } from '../../utils/helper';
import { backgroundClass, providerApiMethod } from '../decorators';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

type SolanaSendOptions = {
  /** disable transaction verification step */
  skipPreflight?: boolean;
  /** preflight commitment level */
  preflightCommitment?: string;
  /** Maximum number of times for the RPC node to retry sending the transaction to the leader. */
  maxRetries?: number;
};

const Mocks = {
  publicKey: 'GWYfd2h4UhEb3hTj52M5jc6aefCKN2thnUkc5uk924kr',
  tx: 'C45YSQ38Zu1mYrNAqbBH48oKWziYvjMv82MLvPss8LQ1kr5iV6QEQuQtqfbxdLmM45Bg6Mi87mkGauaWdnhxLcuUYoSsaVJyn4PkoQALU1ef2vEhQAwQY2FY7xUfeNXkiEmaFrvTzUMBZCKsZEcYCUp2NyahbJe7QAidPmsfmwMWZjA1drjvpYQd7htAuKbPY3XxH65doYp6zBnXF3LFaFwfb9g2Avam5UhsLiUqYYDoYXsfQc7PkKgrj',
  txSignature:
    'x7GahzCceEaCCyw8y3GJ8bNMM2GRuwHGT8aEdzQdqhUaTCXECPvqBDeEEg1PSCDhxwHa4u6iK94FutptzaHkhdb',
  signedMessage:
    '3XkHEaU3NzNsnyYqAX53DeoXfziByN4XffWLqvM3jK7Lq82FjqBrGk2tgsd2CqnUZ36EVFMpSekFDc72PPfLE6J2',
};

@backgroundClass()
class ProviderApiSolana extends ProviderApiBase {
  public providerName = IInjectedProviderNames.solana;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = () => {
      const result = {
        // TODO do not emit events to EVM Dapps, injected provider check scope
        method: 'accountsChanged',
        params: { accounts: [] },
      };
      return result;
    };

    info.send(data);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // TODO
    console.log(info);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotFound();
  }

  // ----------------------------------------------

  @providerApiMethod()
  public disconnect() {
    console.log('disconnect');
  }

  @providerApiMethod()
  public signTransaction(
    payload: IJsBridgeMessagePayload,
    params: { message: string },
  ) {
    if (typeof params.message !== 'string') {
      throw web3Errors.rpc.invalidInput();
    }
    // TODO: validate message is a transaction
    return Mocks.tx;
  }

  @providerApiMethod()
  public signAllTransactions(
    payload: IJsBridgeMessagePayload,
    params: { message: string[] },
  ) {
    const { message } = params;

    if (!isArray(message) || message.length === 0 || !message.every(isString)) {
      throw web3Errors.rpc.invalidInput();
    }

    // todo: validate message is  transactions
    console.log('signAllTransactions', payload, params);
    return message.map(() => Mocks.tx);
  }

  @providerApiMethod()
  public signAndSendTransaction(
    payload: IJsBridgeMessagePayload,
    params: { message: string; options?: SolanaSendOptions },
  ) {
    const { message } = params;

    if (!isString(message)) {
      throw web3Errors.rpc.invalidInput();
    }

    // todo: validate message is  transactions
    console.log('signTransaction', payload, params);
    return {
      signature: Mocks.txSignature,
      publicKey: Mocks.publicKey,
    };
  }

  @providerApiMethod()
  public signMessage(
    payload: IJsBridgeMessagePayload,
    params: {
      message: string;
      display?: 'hex' | 'utf8';
    },
  ) {
    const { message, display = 'utf8' } = params;

    if (!isString(message) || !['utf8', 'hex'].includes(display)) {
      throw web3Errors.rpc.invalidInput();
    }

    console.log('signMessage', payload, params);
    return {
      signature: Mocks.signedMessage,
      publicKey: Mocks.publicKey,
    };
  }

  @providerApiMethod()
  public async connect(
    _: IJsBridgeMessagePayload,
    params?: { onlyIfTrusted: boolean },
  ) {
    const { onlyIfTrusted = false } = params || {};

    if (onlyIfTrusted) {
      // throw error if user haven't trusted the app
    } else {
      // mock user action delay
      await wait(3000);
    }

    return {
      publicKey: Mocks.publicKey,
    };
  }
}

export default ProviderApiSolana;
