// cspell:ignore uniffi Msat
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IBreezSdkSparkModule,
  ISparkHtlcDetails,
  ISparkParsedInput,
  ISparkPayment,
  ISparkPaymentDetails,
  ISparkPreparedPayment,
  ISparkSdk,
  ISparkSdkConfig,
  ISparkSdkEvent,
} from './types';
import type * as BreezRn from '@breeztech/breez-sdk-spark-react-native';

// The native build of the Breez SDK (uniffi) differs from the web build in
// three ways: a variant is an object with `tag` and `inner` where the web
// build has a plain object with `type`, a plain enum is a number where the
// web build has a string, and every u64 is a bigint. This file turns what the
// app reads into the web shapes of ./types and builds native requests from
// them. Types only are imported from the package: importing its code
// installs the Rust crate into whichever runtime imports it.

export type IBreezSdkSparkNative = typeof BreezRn;

function toSafeNumber(value: bigint, field: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new OneKeyLocalError(`Breez SDK returned an unsafe ${field}`);
  }
  return result;
}

// 'Bolt11Invoice' -> 'bolt11Invoice', the web build's name for a variant.
function toWebVariantName(tag: string): string {
  return tag.charAt(0).toLowerCase() + tag.slice(1);
}

function toSparkHtlcDetails(htlc: BreezRn.SparkHtlcDetails): ISparkHtlcDetails {
  return { paymentHash: htlc.paymentHash, preimage: htlc.preimage };
}

export function createBreezSdkNativeAdapter({
  rn,
  resolveStorageDir,
}: {
  rn: IBreezSdkSparkNative;
  // Turns the storage name the service uses into a directory of the app.
  resolveStorageDir: (name: string) => Promise<string>;
}): IBreezSdkSparkModule {
  const toPaymentType = (
    value: BreezRn.PaymentType,
  ): ISparkPayment['paymentType'] =>
    value === rn.PaymentType.Send ? 'send' : 'receive';

  const toPaymentStatus = (
    value: BreezRn.PaymentStatus,
  ): ISparkPayment['status'] => {
    switch (value) {
      case rn.PaymentStatus.Completed:
        return 'completed';
      case rn.PaymentStatus.Pending:
        return 'pending';
      default:
        return 'failed';
    }
  };

  const toPaymentMethod = (
    value: BreezRn.PaymentMethod,
  ): ISparkPayment['method'] => {
    switch (value) {
      case rn.PaymentMethod.Lightning:
        return 'lightning';
      case rn.PaymentMethod.Spark:
        return 'spark';
      case rn.PaymentMethod.Token:
        return 'token';
      case rn.PaymentMethod.Deposit:
        return 'deposit';
      case rn.PaymentMethod.Withdraw:
        return 'withdraw';
      default:
        return 'unknown';
    }
  };

  const toPaymentDetails = (
    details: BreezRn.PaymentDetails,
  ): ISparkPaymentDetails => {
    switch (details.tag) {
      case rn.PaymentDetails_Tags.Lightning:
        return {
          type: 'lightning',
          invoice: details.inner.invoice,
          description: details.inner.description,
          destinationPubkey: details.inner.destinationPubkey,
          htlcDetails: toSparkHtlcDetails(details.inner.htlcDetails),
        };
      case rn.PaymentDetails_Tags.Spark:
        return {
          type: 'spark',
          htlcDetails: details.inner.htlcDetails
            ? toSparkHtlcDetails(details.inner.htlcDetails)
            : undefined,
        };
      case rn.PaymentDetails_Tags.Token:
        return { type: 'token' };
      case rn.PaymentDetails_Tags.Withdraw:
        return { type: 'withdraw' };
      default:
        return { type: 'deposit' };
    }
  };

  const toPayment = (payment: BreezRn.Payment): ISparkPayment => ({
    id: payment.id,
    paymentType: toPaymentType(payment.paymentType),
    status: toPaymentStatus(payment.status),
    amount: payment.amount,
    fees: payment.fees,
    timestamp: toSafeNumber(payment.timestamp, 'payment timestamp'),
    method: toPaymentMethod(payment.method),
    details: payment.details ? toPaymentDetails(payment.details) : undefined,
  });

  const toEvent = (event: BreezRn.SdkEvent): ISparkSdkEvent => {
    switch (event.tag) {
      case rn.SdkEvent_Tags.PaymentSucceeded:
        return {
          type: 'paymentSucceeded',
          payment: toPayment(event.inner.payment),
        };
      case rn.SdkEvent_Tags.PaymentPending:
        return {
          type: 'paymentPending',
          payment: toPayment(event.inner.payment),
        };
      case rn.SdkEvent_Tags.PaymentFailed:
        return {
          type: 'paymentFailed',
          payment: toPayment(event.inner.payment),
        };
      case rn.SdkEvent_Tags.PaymentMetadataUpdated:
        return {
          type: 'paymentMetadataUpdated',
          payment: toPayment(event.inner.payment),
        };
      default:
        // The app reads nothing but the name of the other events.
        return { type: toWebVariantName(event.tag) } as ISparkSdkEvent;
    }
  };

  const toParsedInput = (input: BreezRn.InputType): ISparkParsedInput => {
    if (input.tag === rn.InputType_Tags.Bolt11Invoice) {
      const [invoice] = input.inner;
      return {
        type: 'bolt11Invoice',
        paymentHash: invoice.paymentHash,
        timestamp: toSafeNumber(invoice.timestamp, 'invoice timestamp'),
        expiry: toSafeNumber(invoice.expiry, 'invoice expiry'),
      };
    }
    // The app only tells a BOLT11 invoice from everything else.
    return { type: toWebVariantName(input.tag) } as ISparkParsedInput;
  };

  const toPreparedPayment = (
    prepared: BreezRn.PrepareSendPaymentResponse,
  ): ISparkPreparedPayment => {
    const method = prepared.paymentMethod;
    return {
      paymentMethod:
        method.tag === rn.SendPaymentMethod_Tags.Bolt11Invoice
          ? {
              type: 'bolt11Invoice',
              invoiceDetails: {
                invoice: { bolt11: method.inner.invoiceDetails.invoice.bolt11 },
                paymentHash: method.inner.invoiceDetails.paymentHash,
                amountMsat:
                  method.inner.invoiceDetails.amountMsat === undefined
                    ? undefined
                    : toSafeNumber(
                        method.inner.invoiceDetails.amountMsat,
                        'invoice amount',
                      ),
              },
              lightningFeeSats: toSafeNumber(
                method.inner.lightningFeeSats,
                'Lightning fee',
              ),
              sparkTransferFeeSats:
                method.inner.sparkTransferFeeSats === undefined
                  ? undefined
                  : toSafeNumber(
                      method.inner.sparkTransferFeeSats,
                      'Spark transfer fee',
                    ),
            }
          : ({
              type: toWebVariantName(method.tag),
            } as ISparkPreparedPayment['paymentMethod']),
      amount: prepared.amount,
      feePolicy:
        prepared.feePolicy === rn.FeePolicy.FeesExcluded
          ? 'feesExcluded'
          : 'feesIncluded',
      tokenIdentifier: prepared.tokenIdentifier,
      conversionEstimate: prepared.conversionEstimate,
    };
  };

  const wrapSdk = (sdk: BreezRn.BreezSdkInterface): ISparkSdk => {
    // sendPayment needs the native object behind the view the app checked.
    const preparedByView = new WeakMap<
      ISparkPreparedPayment,
      BreezRn.PrepareSendPaymentResponse
    >();
    return {
      async getInfo(request) {
        const info = await sdk.getInfo({ ensureSynced: request.ensureSynced });
        return {
          identityPubkey: info.identityPubkey,
          balanceSats: toSafeNumber(info.balanceSats, 'balance'),
        };
      },
      async getUserSettings() {
        const settings = await sdk.getUserSettings();
        return { sparkPrivateModeEnabled: settings.sparkPrivateModeEnabled };
      },
      async updateUserSettings(request) {
        await sdk.updateUserSettings({
          sparkPrivateModeEnabled: request.sparkPrivateModeEnabled,
          stableBalanceActiveLabel: undefined,
          sparkMasterIdentityPublicKey: undefined,
        });
      },
      async syncWallet() {
        await sdk.syncWallet({});
      },
      async receivePayment({ paymentMethod }) {
        const response = await sdk.receivePayment({
          paymentMethod:
            paymentMethod.type === 'bolt11Invoice'
              ? new rn.ReceivePaymentMethod.Bolt11Invoice({
                  description: paymentMethod.description,
                  amountSats:
                    paymentMethod.amountSats === undefined
                      ? undefined
                      : BigInt(paymentMethod.amountSats),
                  expirySecs: undefined,
                  paymentHash: undefined,
                  receiverIdentityPublicKey: undefined,
                })
              : new rn.ReceivePaymentMethod.SparkAddress(),
        });
        return { paymentRequest: response.paymentRequest };
      },
      async parse(input) {
        return toParsedInput(await sdk.parse(input));
      },
      async listPayments(request) {
        const { payments } = await sdk.listPayments({
          typeFilter: request.typeFilter?.map((type) =>
            type === 'send' ? rn.PaymentType.Send : rn.PaymentType.Receive,
          ),
          statusFilter: undefined,
          assetFilter: undefined,
          paymentDetailsFilter: undefined,
          fromTimestamp: undefined,
          toTimestamp: undefined,
          offset: request.offset,
          limit: request.limit,
          sortAscending: undefined,
        });
        return { payments: payments.map(toPayment) };
      },
      async prepareSendPayment(request) {
        const prepared = await sdk.prepareSendPayment({
          paymentRequest: new rn.PaymentRequest.Input({
            input: request.paymentRequest.input,
          }),
          amount: request.amount,
          tokenIdentifier: undefined,
          conversionOptions: undefined,
          feePolicy: undefined,
        });
        const view = toPreparedPayment(prepared);
        preparedByView.set(view, prepared);
        return view;
      },
      async sendPayment(request) {
        const prepared = preparedByView.get(request.prepareResponse);
        if (!prepared) {
          throw new OneKeyLocalError('Unknown Lightning payment preparation');
        }
        const { options } = request;
        if (options && options.type !== 'bolt11Invoice') {
          throw new OneKeyLocalError('Breez SDK sends BOLT11 payments only');
        }
        const { payment } = await sdk.sendPayment({
          prepareResponse: prepared,
          options: options
            ? new rn.SendPaymentOptions.Bolt11Invoice({
                preferSpark: options.preferSpark,
                completionTimeoutSecs: options.completionTimeoutSecs,
              })
            : undefined,
          idempotencyKey: undefined,
        });
        return { payment: toPayment(payment) };
      },
      addEventListener(listener) {
        return sdk.addEventListener({
          onEvent: async (event) => {
            listener.onEvent(toEvent(event));
          },
        });
      },
      async disconnect() {
        try {
          await sdk.disconnect();
        } finally {
          // Frees the Rust object now instead of at garbage collection.
          (sdk as { uniffiDestroy?: () => void }).uniffiDestroy?.();
        }
      },
    };
  };

  return {
    defaultConfig(network) {
      return rn.defaultConfig(
        network === 'mainnet' ? rn.Network.Mainnet : rn.Network.Regtest,
      );
    },
    async connect(request) {
      // The service copies the native config defaultConfig returned and
      // changes a few fields, so the rest of the native config is still there.
      const config = request.config as ISparkSdkConfig & BreezRn.Config;
      if (typeof config.network !== 'number') {
        throw new OneKeyLocalError('Breez SDK config is not a native config');
      }
      if (request.seed.type !== 'mnemonic') {
        throw new OneKeyLocalError('Breez SDK connects with a mnemonic only');
      }
      const sdk = await rn.connect({
        config,
        seed: new rn.Seed.Mnemonic({
          mnemonic: request.seed.mnemonic,
          passphrase: undefined,
        }),
        storageDir: await resolveStorageDir(request.storageDir),
      });
      return wrapSdk(sdk);
    },
  };
}
