import { DUST_AMOUNT, addressFromTokenId, codec } from '@alephium/web3';

import {
  EAlphTxType,
  type IEncodedTxAlph,
} from '@onekeyhq/core/src/chains/alph/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { AlephTooManyInputsError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';

import { Provider } from './provider';

import type { SignTransferTxParams, node } from '@alephium/web3';

function getReturnedInputLimit(params: unknown): number | undefined {
  if (!params || typeof params !== 'object' || !('count' in params))
    return undefined;
  if (typeof params.count !== 'string') return undefined;
  const match = /^max\s+([1-9]\d*)\s+supported$/iu.exec(params.count.trim());
  if (!match) return undefined;
  const limit = Number(match[1]);
  return Number.isSafeInteger(limit) ? limit : undefined;
}

function sumAlph(utxos: node.UTXO[]): bigint {
  return utxos.reduce((total, utxo) => total + BigInt(utxo.amount), 0n);
}

function tokenAmount(utxo: node.UTXO, tokenId: string): bigint {
  return BigInt(
    utxo.tokens?.find((token) => token.id === tokenId)?.amount ?? '0',
  );
}

function getCandidateAmount({
  inputs,
  destination,
  budget,
  fee,
  changeReserve,
}: {
  inputs: node.UTXO[];
  destination: SignTransferTxParams['destinations'][number];
  budget: number;
  fee: bigint;
  changeReserve: bigint;
}): bigint {
  const token = destination.tokens?.[0];
  if (!token) {
    // Follow the actual node-selected input order, including small UTXOs.
    return sumAlph(inputs.slice(0, budget)) - fee - changeReserve;
  }
  const tokenInputs = inputs.filter((utxo) => tokenAmount(utxo, token.id) > 0n);
  const feeInputs = inputs.filter((utxo) => tokenAmount(utxo, token.id) === 0n);
  const requiredAlph =
    BigInt(destination.attoAlphAmount.toString()) + fee + changeReserve;
  for (
    let count = Math.min(budget, tokenInputs.length);
    count > 0;
    count -= 1
  ) {
    const selected = tokenInputs.slice(0, count);
    let alph = sumAlph(selected);
    let inputCount = count;
    for (const utxo of feeInputs) {
      if (alph >= requiredAlph || inputCount === budget) break;
      alph += BigInt(utxo.amount);
      inputCount += 1;
    }
    if (alph >= requiredAlph) {
      return selected.reduce(
        (total, utxo) => total + tokenAmount(utxo, token.id),
        0n,
      );
    }
  }
  return 0n;
}

export async function getAlphHardwareInputLimitError({
  error,
  unsignedTx,
  encodedTx,
  backgroundApi,
  networkId,
  accountId,
}: {
  error: IOneKeyError;
  unsignedTx: string;
  encodedTx: IEncodedTxAlph;
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
}): Promise<IOneKeyError> {
  // Called only after a real TooManyInputs rejection. Never infer device capacity.
  const payload = error.payload;
  const limit = getReturnedInputLimit(payload?.params);
  if (!payload || !limit || encodedTx.type !== EAlphTxType.Transfer)
    return error;
  const params = encodedTx.params as SignTransferTxParams;
  if (params.utxos || params.destinations.length !== 1) return error;
  const destination = params.destinations[0];
  const token = destination.tokens?.[0];
  if ((destination.tokens?.length ?? 0) > 1) return error;

  try {
    if (token && BigInt(destination.attoAlphAmount.toString()) > DUST_AMOUNT)
      return error;
    const transaction = codec.unsignedTxCodec.decode(
      Buffer.from(unsignedTx, 'hex'),
    );
    if (
      transaction.inputs.length <= limit ||
      transaction.statefulScript.kind !== 'None'
    )
      return error;
    const provider = new Provider({ backgroundApi, networkId });
    const { utxos } = await provider.addresses.getAddressesAddressUtxos(
      params.signerAddress,
    );
    const byRef = new Map(
      utxos.map((utxo) => [
        `${utxo.ref.hint}:${utxo.ref.key.toLowerCase()}`,
        utxo,
      ]),
    );
    const inputs: node.UTXO[] = [];
    for (const input of transaction.inputs) {
      const utxo = byRef.get(
        `${input.hint}:${Buffer.from(input.key).toString('hex')}`,
      );
      // An input can disappear between building, device confirmation and recovery.
      if (!utxo) return error;
      inputs.push(utxo);
    }
    const fee = BigInt(transaction.gasAmount) * transaction.gasPrice;
    const changeReserve =
      DUST_AMOUNT * BigInt(Math.max(1, transaction.fixedOutputs.length - 1));
    const requested = BigInt(
      (token?.amount ?? destination.attoAlphAmount).toString(),
    );
    const amount = getCandidateAmount({
      inputs,
      destination,
      budget: limit,
      fee,
      changeReserve,
    });
    if (amount <= 0n || amount >= requested || (!token && amount < DUST_AMOUNT))
      return error;
    const network = await backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    const tokenInfo = token
      ? await backgroundApi.serviceToken.getToken({
          accountId,
          networkId,
          tokenIdOnNetwork: addressFromTokenId(token.id),
        })
      : undefined;
    if (token && !tokenInfo) return error;
    const info = {
      amount: tokenInfo
        ? chainValueUtils.convertTokenChainValueToAmount({
            value: amount.toString(),
            token: tokenInfo,
          })
        : chainValueUtils.convertChainValueToAmount({
            value: amount.toString(),
            network,
          }),
      symbol: tokenInfo?.symbol ?? network.symbol,
    };
    return new AlephTooManyInputsError({
      payload,
      key: ETranslations.feedback_kaspa_utxo_limit_exceeded_text,
      info,
      message: appLocale.intl.formatMessage(
        { id: ETranslations.feedback_kaspa_utxo_limit_exceeded_text },
        info,
      ),
    });
  } catch {
    // Advisory RPC failures must not replace the actual hardware rejection.
    defaultLogger.app.error.log(
      'Failed to calculate ALPH input-limit amount suggestion',
    );
  }
  return error;
}
