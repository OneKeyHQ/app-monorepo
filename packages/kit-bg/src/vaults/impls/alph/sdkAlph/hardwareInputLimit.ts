import {
  DUST_AMOUNT,
  TransactionBuilder,
  addressFromTokenId,
  codec,
} from '@alephium/web3';
import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  EAlphTxType,
  type IEncodedTxAlph,
} from '@onekeyhq/core/src/chains/alph/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  OneKeyLocalError,
  TooManyTransactionInputs,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';

import { Provider } from './provider';

import type { SignTransferTxParams, node } from '@alephium/web3';

export function getAlphHardwareInputLimit(
  deviceType?: IDBDevice['deviceType'],
): number | undefined {
  return deviceType === EDeviceType.Classic1s ||
    deviceType === EDeviceType.ClassicPure
    ? 16
    : undefined;
}

function sumAlph(utxos: node.UTXO[]): bigint {
  return utxos.reduce((sum, utxo) => sum + BigInt(utxo.amount), 0n);
}

function getTokenAmount(utxo: node.UTXO, tokenId: string): bigint {
  return BigInt(
    utxo.tokens?.find((token) => token.id === tokenId)?.amount ?? '0',
  );
}

function getAmountHint({
  inputs,
  params,
  limit,
  fee,
  changeDust,
}: {
  inputs: node.UTXO[];
  params: SignTransferTxParams;
  limit: number;
  fee: bigint;
  changeDust: bigint;
}): { amount: bigint; tokenId?: string } {
  const destination = params.destinations[0];
  const token = destination.tokens?.[0];
  if (!token) {
    // The node selects smaller UTXOs first. Preserve the actual input order;
    // the largest 16 would advertise an amount its default selector cannot sign.
    const amount = sumAlph(inputs.slice(0, limit)) - fee - changeDust;
    return { amount: amount > 0n ? amount : 0n };
  }

  const tokenInputs = inputs.filter(
    (input) => getTokenAmount(input, token.id) > 0n,
  );
  const feeInputs = inputs.filter(
    (input) => getTokenAmount(input, token.id) === 0n,
  );
  const requiredAlph =
    BigInt(destination.attoAlphAmount.toString()) + fee + changeDust;
  for (let count = Math.min(limit, tokenInputs.length); count > 0; count -= 1) {
    const selected = tokenInputs.slice(0, count);
    let alph = sumAlph(selected);
    let inputCount = count;
    for (const input of feeInputs) {
      if (alph >= requiredAlph || inputCount === limit) {
        break;
      }
      alph += BigInt(input.amount);
      inputCount += 1;
    }
    if (alph >= requiredAlph) {
      return {
        amount: selected.reduce(
          (sum, input) => sum + getTokenAmount(input, token.id),
          0n,
        ),
        tokenId: token.id,
      };
    }
  }
  return { amount: 0n, tokenId: token.id };
}

export async function checkAlphHardwareInputLimit({
  unsignedTx,
  encodedTx,
  backgroundApi,
  networkId,
  accountId,
  deviceType,
  publicKey,
}: {
  unsignedTx: string;
  encodedTx: IEncodedTxAlph;
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  deviceType?: IDBDevice['deviceType'];
  publicKey: string;
}): Promise<void> {
  const limit = getAlphHardwareInputLimit(deviceType);
  if (!limit) {
    return;
  }
  const transaction = codec.unsignedTxCodec.decode(
    Buffer.from(unsignedTx, 'hex'),
  );
  if (transaction.inputs.length <= limit) {
    return;
  }
  const fallbackError = new TooManyTransactionInputs({
    info: { number: transaction.inputs.length, max: limit },
  });
  if (encodedTx.type !== EAlphTxType.Transfer) {
    throw fallbackError;
  }
  const params = encodedTx.params as SignTransferTxParams;
  // Explicit input sets and multi-asset calls cannot be repaired by reducing
  // one transfer amount. Do not give them a misleading amount suggestion.
  if (
    params.utxos ||
    params.destinations.length !== 1 ||
    (params.destinations[0].tokens?.length ?? 0) > 1 ||
    (!!params.destinations[0].tokens?.length &&
      BigInt(params.destinations[0].attoAlphAmount.toString()) > DUST_AMOUNT)
  ) {
    throw fallbackError;
  }

  const provider = new Provider({ backgroundApi, networkId });
  const { utxos } = await provider.addresses.getAddressesAddressUtxos(
    params.signerAddress,
  );
  const values = new Map(
    utxos.map((utxo) => [
      `${utxo.ref.hint}:${utxo.ref.key.toLowerCase()}`,
      utxo,
    ]),
  );
  const inputs: node.UTXO[] = [];
  for (const input of transaction.inputs) {
    const utxo = values.get(
      `${input.hint}:${Buffer.from(input.key).toString('hex')}`,
    );
    if (!utxo) {
      // The input may have been spent since the transaction was built.
      throw fallbackError;
    }
    inputs.push(utxo);
  }
  const builder = TransactionBuilder.from(provider);
  const destination = params.destinations[0];
  const requestedAmount = BigInt(
    (destination.tokens?.[0]?.amount ?? destination.attoAlphAmount).toString(),
  );
  let hint: ReturnType<typeof getAmountHint> | undefined;
  let lastAmount: bigint | undefined;
  for (let budget = limit; budget > 0; budget -= 1) {
    const candidate = getAmountHint({
      inputs,
      params,
      limit: budget,
      fee: BigInt(transaction.gasAmount) * transaction.gasPrice,
      changeDust:
        DUST_AMOUNT * BigInt(Math.max(1, transaction.fixedOutputs.length - 1)),
    });
    if (
      candidate.amount <= 0n ||
      (!candidate.tokenId && candidate.amount < DUST_AMOUNT)
    ) {
      break;
    }
    if (candidate.amount < requestedAmount && candidate.amount !== lastAmount) {
      lastAmount = candidate.amount;
      // A lower token amount can change the ALPH funding inputs. Only advertise
      // a candidate after the same node builder proves it stays within the limit.
      const rebuilt = await builder.buildTransferTx(
        {
          ...params,
          gasAmount: transaction.gasAmount,
          gasPrice: transaction.gasPrice,
          destinations: [
            candidate.tokenId
              ? {
                  ...destination,
                  tokens: [
                    {
                      ...destination.tokens?.[0],
                      id: candidate.tokenId,
                      amount: candidate.amount,
                    },
                  ],
                }
              : { ...destination, attoAlphAmount: candidate.amount },
          ],
        },
        publicKey,
      );
      const rebuiltTransaction = codec.unsignedTxCodec.decode(
        Buffer.from(rebuilt.unsignedTx, 'hex'),
      );
      if (rebuiltTransaction.inputs.length <= limit) {
        hint = candidate;
        break;
      }
    }
  }
  if (!hint) {
    throw fallbackError;
  }
  const network = await backgroundApi.serviceNetwork.getNetwork({ networkId });
  const token = hint.tokenId
    ? await backgroundApi.serviceToken.getToken({
        accountId,
        networkId,
        tokenIdOnNetwork: addressFromTokenId(hint.tokenId),
      })
    : undefined;
  if (hint.tokenId && !token) {
    throw fallbackError;
  }
  throw new OneKeyLocalError(
    appLocale.intl.formatMessage(
      { id: ETranslations.feedback_kaspa_utxo_limit_exceeded_text },
      {
        amount: token
          ? chainValueUtils.convertTokenChainValueToAmount({
              value: hint.amount.toString(),
              token,
            })
          : chainValueUtils.convertChainValueToAmount({
              value: hint.amount.toString(),
              network,
            }),
        symbol: token?.symbol ?? network.symbol,
      },
    ),
  );
}
