import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EMessageTypesStellar } from '@onekeyhq/shared/types/message';

import sdkStellar from '../sdkStellar';

const { xdr, StellarSdk } = sdkStellar;

type IAuthorizationEntry = ReturnType<
  typeof xdr.SorobanAuthorizationEntry.fromXDR
>;

export type IStellarHashMessageParams =
  | {
      messageType: EMessageTypesStellar.SIGN_MESSAGE;
      message: string;
    }
  | {
      messageType: EMessageTypesStellar.SIGN_AUTH_ENTRY;
      message: string | IAuthorizationEntry;
      networkPassphrase: string;
    };

/**
 * Hash message for Stellar signing
 * Supports two types:
 * 1. SIGN_MESSAGE: Standard message signing with prefix
 * 2. SIGN_AUTH: Soroban authorization entry signing
 */
export function hashMessage(params: IStellarHashMessageParams): Buffer {
  const { messageType, message } = params;

  switch (messageType) {
    case EMessageTypesStellar.SIGN_MESSAGE: {
      // Standard message signing with prefix (SEP-53)
      // https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md
      const prefix = Buffer.from('Stellar Signed Message:\n');
      const messageBytes =
        typeof message === 'string'
          ? Buffer.from(message, 'utf-8')
          : Buffer.from(message);
      const payload = Buffer.concat([prefix, messageBytes]);
      return StellarSdk.hash(payload);
    }

    case EMessageTypesStellar.SIGN_AUTH_ENTRY: {
      // Soroban authorization entry signing
      if (!('networkPassphrase' in params) || !params.networkPassphrase) {
        throw new OneKeyLocalError(
          'signAuthEntry hash requires a networkPassphrase',
        );
      }

      const { networkPassphrase } = params;

      // Parse authorization entry if it's a string
      const authEntry: IAuthorizationEntry =
        typeof message === 'string'
          ? xdr.SorobanAuthorizationEntry.fromXDR(message, 'base64')
          : message;

      // Extract credentials address
      const credentialsAddress = authEntry.credentials().address();
      const nonce = credentialsAddress.nonce();
      const signatureExpirationLedger =
        credentialsAddress.signatureExpirationLedger();

      // Construct HashIdPreimage (Soroban signing standard structure)
      const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
        new xdr.HashIdPreimageSorobanAuthorization({
          networkId: StellarSdk.hash(Buffer.from(networkPassphrase)),
          nonce: xdr.Int64.fromString(String(nonce)),
          signatureExpirationLedger,
          invocation: authEntry.rootInvocation(),
        }),
      );

      return StellarSdk.hash(preimage.toXDR());
    }

    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new OneKeyLocalError(`Invalid messageType: ${messageType}`);
  }
}
