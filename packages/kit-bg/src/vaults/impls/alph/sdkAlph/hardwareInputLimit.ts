import {
  DEFAULT_GAS_AMOUNT,
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

function compareAmounts(a: bigint, b: bigint): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

function hasEnoughP2pkhGas(
  transaction: ReturnType<typeof codec.unsignedTxCodec.decode>,
): boolean {
  if (
    transaction.statefulScript.kind !== 'None' ||
    transaction.inputs[0]?.unlockScript.kind !== 'P2PKH' ||
    transaction.inputs
      .slice(1)
      .some((input) => input.unlockScript.kind !== 'SameAsPrevious')
  ) {
    return false;
  }
  // Standard P2PKH gas: base 1000, input 2000, output 4500,
  // and 2060 for the first public-key unlock. Other scripts are excluded.
  return (
    transaction.gasAmount >=
    Math.max(
      DEFAULT_GAS_AMOUNT,
      1000 +
        transaction.inputs.length * 2000 +
        transaction.fixedOutputs.length * 4500 +
        2060,
    )
  );
}

function selectLargestInputs({
  inputs,
  params,
  limit,
  fee,
}: {
  inputs: node.UTXO[];
  params: SignTransferTxParams;
  limit: number;
  fee: bigint;
}): { inputs: node.UTXO[]; amount: bigint; tokenId?: string } | undefined {
  const destination = params.destinations[0];
  const token = destination.tokens?.[0];
  const requiredAlph = BigInt(destination.attoAlphAmount.toString()) + fee;
  if (!token) {
    const selected: node.UTXO[] = [];
    let amount = 0n;
    for (const input of inputs.toSorted((a, b) =>
      compareAmounts(BigInt(a.amount), BigInt(b.amount)),
    )) {
      if (selected.length === limit || amount >= requiredAlph + DUST_AMOUNT) {
        break;
      }
      selected.push(input);
      amount += BigInt(input.amount);
    }
    return { inputs: selected, amount: amount - fee - DUST_AMOUNT };
  }

  const tokenInputs = inputs
    .filter((input) => getTokenAmount(input, token.id) > 0n)
    .toSorted(
      (a, b) =>
        compareAmounts(
          getTokenAmount(a, token.id),
          getTokenAmount(b, token.id),
        ) || compareAmounts(BigInt(a.amount), BigInt(b.amount)),
    );
  let count = 0;
  let tokens = 0n;
  while (
    count < Math.min(limit, tokenInputs.length) &&
    tokens < BigInt(token.amount.toString())
  ) {
    tokens += getTokenAmount(tokenInputs[count], token.id);
    count += 1;
  }
  // Reserve separate native and token change outputs. The retry never pulls
  // unrelated tokens into the transaction, so two dust amounts are sufficient.
  for (; count > 0; count -= 1) {
    const selected = tokenInputs.slice(0, count);
    let alph = sumAlph(selected);
    const feeInputs = inputs
      .filter((input) => !selected.includes(input))
      .toSorted((a, b) => compareAmounts(BigInt(a.amount), BigInt(b.amount)));
    for (const input of feeInputs) {
      if (
        selected.length === limit ||
        alph >= requiredAlph + 2n * DUST_AMOUNT
      ) {
        break;
      }
      selected.push(input);
      alph += BigInt(input.amount);
    }
    if (alph >= requiredAlph + 2n * DUST_AMOUNT) {
      return {
        inputs: selected,
        amount: selected.reduce(
          (sum, input) => sum + getTokenAmount(input, token.id),
          0n,
        ),
        tokenId: token.id,
      };
    }
  }
  return undefined;
}

export async function prepareAlphHardwareTransaction({
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
}): Promise<{ unsignedTx: string; encodedTx: IEncodedTxAlph }> {
  const original = { unsignedTx, encodedTx };
  const limit = getAlphHardwareInputLimit(deviceType);
  if (!limit) {
    return original;
  }
  const transaction = codec.unsignedTxCodec.decode(
    Buffer.from(unsignedTx, 'hex'),
  );
  if (transaction.inputs.length <= limit) {
    return original;
  }
  const fallbackError = new TooManyTransactionInputs({
    info: { number: transaction.inputs.length, max: limit },
  });
  if (encodedTx.type !== EAlphTxType.Transfer) {
    throw fallbackError;
  }
  const params = encodedTx.params as SignTransferTxParams;
  if (
    !hasEnoughP2pkhGas(transaction) ||
    (params.signerKeyType && params.signerKeyType !== 'default') ||
    params.utxos ||
    params.destinations.length !== 1 ||
    (params.destinations[0].tokens?.length ?? 0) > 1 ||
    (!!params.destinations[0].tokens?.length &&
      BigInt(params.destinations[0].attoAlphAmount.toString()) > DUST_AMOUNT)
  ) {
    throw fallbackError;
  }
  const destination = params.destinations[0];
  const tokenId = destination.tokens?.[0]?.id;
  const provider = new Provider({ backgroundApi, networkId });
  const { utxos } = await provider.addresses.getAddressesAddressUtxos(
    params.signerAddress,
  );
  const seen = new Set<string>();
  const inputs = utxos.filter((utxo) => {
    const key = `${utxo.ref.hint}:${utxo.ref.key.toLowerCase()}`;
    // Explicit input builds do not apply the node's default lock-time filter.
    // Keep other assets out of the retry to bound change dust and output count.
    if (
      seen.has(key) ||
      (utxo.lockTime ?? 0) > Date.now() ||
      utxo.tokens?.some((token) => token.id !== tokenId)
    ) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const selected = selectLargestInputs({
    inputs,
    params,
    limit,
    fee: BigInt(transaction.gasAmount) * transaction.gasPrice,
  });
  if (
    !selected ||
    selected.amount <= 0n ||
    (!tokenId && selected.amount < DUST_AMOUNT)
  ) {
    throw fallbackError;
  }
  const requestedAmount = BigInt(
    (destination.tokens?.[0]?.amount ?? destination.attoAlphAmount).toString(),
  );
  const reduced = selected.amount < requestedAmount;
  const retryParams: SignTransferTxParams = {
    ...params,
    utxos: selected.inputs.map((input) => input.ref),
    // Preserve the fee already shown to the user when only the inputs change.
    gasAmount: transaction.gasAmount,
    gasPrice: transaction.gasPrice.toString(),
    destinations: reduced
      ? [
          tokenId
            ? {
                ...destination,
                tokens: [{ id: tokenId, amount: selected.amount.toString() }],
              }
            : { ...destination, attoAlphAmount: selected.amount.toString() },
        ]
      : params.destinations,
  };
  const rebuilt = await TransactionBuilder.from(provider).buildTransferTx(
    retryParams,
    publicKey,
  );
  const rebuiltTransaction = codec.unsignedTxCodec.decode(
    Buffer.from(rebuilt.unsignedTx, 'hex'),
  );
  const selectedRefs = new Set(
    selected.inputs.map(
      (input) => `${input.ref.hint}:${input.ref.key.toLowerCase()}`,
    ),
  );
  const rebuiltRefs = new Set(
    rebuiltTransaction.inputs.map(
      (input) => `${input.hint}:${Buffer.from(input.key).toString('hex')}`,
    ),
  );
  if (
    !hasEnoughP2pkhGas(rebuiltTransaction) ||
    rebuiltTransaction.inputs.length > limit ||
    rebuiltTransaction.inputs.length !== selectedRefs.size ||
    rebuiltRefs.size !== selectedRefs.size ||
    rebuiltTransaction.gasAmount !== transaction.gasAmount ||
    rebuiltTransaction.gasPrice !== transaction.gasPrice ||
    rebuiltTransaction.inputs.some(
      (input) =>
        !selectedRefs.has(
          `${input.hint}:${Buffer.from(input.key).toString('hex')}`,
        ),
    )
  ) {
    throw fallbackError;
  }
  if (!reduced) {
    return {
      unsignedTx: rebuilt.unsignedTx,
      encodedTx: { ...encodedTx, params: retryParams },
    };
  }
  const network = await backgroundApi.serviceNetwork.getNetwork({ networkId });
  const token = tokenId
    ? await backgroundApi.serviceToken.getToken({
        accountId,
        networkId,
        tokenIdOnNetwork: addressFromTokenId(tokenId),
      })
    : undefined;
  if (tokenId && !token) {
    throw fallbackError;
  }
  throw new OneKeyLocalError(
    appLocale.intl.formatMessage(
      { id: ETranslations.feedback_kaspa_utxo_limit_exceeded_text },
      {
        amount: token
          ? chainValueUtils.convertTokenChainValueToAmount({
              value: selected.amount.toString(),
              token,
            })
          : chainValueUtils.convertChainValueToAmount({
              value: selected.amount.toString(),
              network,
            }),
        symbol: token?.symbol ?? network.symbol,
      },
    ),
  );
}
