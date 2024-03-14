import BigNumber from 'bignumber.js';

import { GAS_TYPE_ARG } from '../utils';

import type {
  GetPastObjectRequest,
  OneKeyJsonRpcProvider,
} from '../provider/OnekeyJsonRpcProvider';
import type {
  ProgrammableTransaction,
  SuiArgument,
  SuiGasData,
} from '@mysten/sui.js';

export async function parseTransactionGasPayment(params: {
  payments?: SuiGasData['payment'] | undefined; // Payment
  client?: OneKeyJsonRpcProvider;
}) {
  const gasAmounts: Map<string, bigint> = new Map();

  const pastObjects: GetPastObjectRequest[] =
    params.payments?.map((payment) => ({
      objectId: payment.objectId,
      version: `${payment.version}`,
    })) ?? [];

  const paymentObjects =
    (await params.client?.tryMultiGetPastObjects({
      past_objects: pastObjects,
      options: {
        'showType': true,
        'showOwner': true,
        'showContent': true,
        'showPreviousTransaction': false,
        'showDisplay': false,
        'showBcs': false,
        'showStorageRebate': false,
      },
    })) ?? [];

  for (const paymentObject of paymentObjects) {
    if (paymentObject.status !== 'VersionNotFound') {
      const regex = /<([^>]+)>/;

      const match = paymentObject.details.type?.match(regex);

      if (match) {
        const extracted = match[1];
        if (paymentObject.details.type.startsWith('0x2::coin::Coin<')) {
          const value = gasAmounts.get(extracted) ?? BigInt(0);
          gasAmounts.set(
            extracted,
            value + BigInt(paymentObject.details.content.fields.balance),
          );
        }
      } else {
        // Not supported at present
      }
    }
  }

  return gasAmounts;
}

async function parseTransactionSplitCoinsInput(
  argument: [SuiArgument, SuiArgument[]],
  inputs: ProgrammableTransaction['inputs'], // Inputs
  client?: OneKeyJsonRpcProvider,
) {
  const [paymentObj, numObj] = argument;
  let coin = '';
  const amounts = [];

  if (typeof paymentObj === 'string' && paymentObj === 'GasCoin') {
    coin = GAS_TYPE_ARG;
  } else if (typeof paymentObj === 'object' && 'Input' in paymentObj) {
    const input = inputs[paymentObj.Input];
    if (input.type === 'object' && input.objectType === 'immOrOwnedObject') {
      const paymentObject = await client?.tryGetPastObject({
        object_id: input.objectId,
        version: new BigNumber(input.version).toNumber(),
        options: {
          'showType': true,
          'showOwner': true,
          'showContent': true,
          'showPreviousTransaction': false,
          'showDisplay': false,
          'showBcs': false,
          'showStorageRebate': false,
        },
      });

      if (paymentObject?.status !== 'VersionNotFound') {
        const regex = /<([^>]+)>/;
        const match = paymentObject?.details.type.match(regex);

        if (match) {
          const extracted = match[1];
          if (paymentObject?.details.type.startsWith('0x2::coin::Coin<')) {
            coin = extracted;
          }
        }
      }
    }
  }

  if (Array.isArray(numObj)) {
    for (const iterator of numObj) {
      if (typeof iterator === 'object' && 'Input' in iterator) {
        amounts.push(inputs[iterator.Input]);
      }
    }
  }

  return {
    coin,
    amounts,
  };
}

async function parseTransactionSplitCoins(params: {
  argument: [SuiArgument, SuiArgument[]];
  inputs: ProgrammableTransaction['inputs']; // Inputs
  client?: OneKeyJsonRpcProvider;
}) {
  const gasAmounts: Map<string, bigint> = new Map();
  const { coin, amounts } = await parseTransactionSplitCoinsInput(
    params.argument,
    params.inputs,
    params.client,
  );

  for (const iterator of amounts) {
    if (iterator?.type === 'pure') {
      if (iterator.valueType === 'u64') {
        // @ts-expect-error
        gasAmounts.set(coin, iterator.value);
      }
    }
  }

  return gasAmounts;
}

export async function parseTransferObjects(params: {
  argument: [SuiArgument[], SuiArgument];
  actions: ProgrammableTransaction['transactions']; // Results
  inputs: ProgrammableTransaction['inputs']; // Inputs
  payments?: SuiGasData['payment'] | undefined; // Payment
  client?: OneKeyJsonRpcProvider;
}) {
  let receive = '';
  const amounts: Map<string, bigint> = new Map();
  // NFT
  // const objects: Map<string, bigint> = new Map();

  const [paymentArg, receiveArg] = params.argument;

  if (Array.isArray(paymentArg)) {
    for (let index = 0; index < paymentArg.length; index += 1) {
      const needInput = paymentArg[index];
      if (
        index === 0 &&
        typeof needInput === 'string' &&
        needInput === 'GasCoin'
      ) {
        const gasAmounts = await parseTransactionGasPayment({
          payments: params.payments,
          client: params.client,
        });

        for (const [key, value] of gasAmounts.entries()) {
          if (amounts.has(key)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            amounts.set(key, amounts.get(key)! + value);
          } else {
            amounts.set(key, value);
          }
        }
      }
      if (typeof needInput === 'object' && 'Result' in needInput) {
        const result = params.actions[needInput.Result];
        if ('SplitCoins' in result) {
          const values = await parseTransactionSplitCoins({
            argument: result.SplitCoins,
            inputs: params.inputs,
            client: params.client,
          });

          for (const [key, value] of values.entries()) {
            if (amounts.has(key)) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              amounts.set(key, values.get(key)! + value);
            } else {
              amounts.set(key, value);
            }
          }
        }
      }
    }
  }

  if (typeof receiveArg === 'object' && 'Input' in receiveArg) {
    const input = params.inputs[receiveArg.Input];

    // @ts-expect-error
    if (input.valueType === 'address') {
      // @ts-expect-error
      receive = input.value;
    }
  }

  return {
    receive,
    amounts,
  };
}
