import BigNumber from 'bignumber.js';

import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EUtxoSelectionStrategy } from '@onekeyhq/shared/types/send';

const SWFT_PROVIDER_KEYWORD = 'swft';
const BTC_SWAP_DEFAULT_FEE_RATE_SATS_PER_VBYTE = '20';
const BTC_SWAP_TX_OVERHEAD_VIRTUAL_BYTES = '10';
const BTC_SWAP_INPUT_VIRTUAL_BYTES = '180';
const BTC_SWAP_OUTPUT_VIRTUAL_BYTES = '43';
const BTC_SWAP_OUTPUT_COUNT = '2';

export type IBtcSwapUtxo = {
  txid: string;
  vout: number;
  value: string;
  address: string;
};

export type IBtcSwapSingleAddressUtxoPlan = {
  userAddress: string;
  refundAddress: string;
  selectedUtxoKeys: string[];
  utxoSelectionStrategy: EUtxoSelectionStrategy.ForceSelected;
};

function includesSwftProviderText(value?: string) {
  return value?.toLowerCase().includes(SWFT_PROVIDER_KEYWORD) ?? false;
}

export function shouldUseBtcSingleAddressUtxoPlan({
  networkId,
  provider,
  providerName,
}: {
  networkId?: string;
  provider?: string;
  providerName?: string;
}) {
  return (
    networkUtils.isBTCNetwork(networkId) &&
    (includesSwftProviderText(provider) ||
      includesSwftProviderText(providerName))
  );
}

function buildUtxoKey(utxo: IBtcSwapUtxo) {
  return `${utxo.txid}:${utxo.vout}`;
}

function toSatsBN({ amount, decimals }: { amount: string; decimals: number }) {
  return new BigNumber(amount)
    .shiftedBy(decimals)
    .integerValue(BigNumber.ROUND_CEIL);
}

export function pickBtcSwapFeeRateSatPerVByte(
  feeUTXO?: Array<{ feeRate?: string }>,
) {
  return feeUTXO?.[1]?.feeRate ?? feeUTXO?.[0]?.feeRate;
}

function normalizeFeeRateSatPerVByte(feeRateSatPerVByte?: string) {
  const feeRate = new BigNumber(
    feeRateSatPerVByte ?? BTC_SWAP_DEFAULT_FEE_RATE_SATS_PER_VBYTE,
  );

  if (!feeRate.isFinite() || feeRate.lte(0)) {
    return new BigNumber(BTC_SWAP_DEFAULT_FEE_RATE_SATS_PER_VBYTE);
  }

  return feeRate;
}

function buildEstimatedRequiredSats({
  amountSats,
  feeRateSatPerVByte,
  inputCount,
}: {
  amountSats: BigNumber;
  feeRateSatPerVByte: string | undefined;
  inputCount: number;
}) {
  const feeRate = normalizeFeeRateSatPerVByte(feeRateSatPerVByte);
  const txVBytes = new BigNumber(BTC_SWAP_TX_OVERHEAD_VIRTUAL_BYTES)
    .plus(new BigNumber(BTC_SWAP_INPUT_VIRTUAL_BYTES).times(inputCount))
    .plus(
      new BigNumber(BTC_SWAP_OUTPUT_VIRTUAL_BYTES).times(BTC_SWAP_OUTPUT_COUNT),
    );

  return amountSats.plus(
    txVBytes.times(feeRate).integerValue(BigNumber.ROUND_CEIL),
  );
}

function buildCandidateForAmount({
  amountSats,
  feeRateSatPerVByte,
  utxos,
}: {
  amountSats: BigNumber;
  feeRateSatPerVByte: string | undefined;
  utxos: IBtcSwapUtxo[];
}) {
  const sortedUtxos = utxos.toSorted((a, b) =>
    new BigNumber(a.value).comparedTo(b.value),
  );
  const singleUtxo = sortedUtxos.find((utxo) => {
    const requiredSats = buildEstimatedRequiredSats({
      amountSats,
      feeRateSatPerVByte,
      inputCount: 1,
    });
    return new BigNumber(utxo.value).gte(requiredSats);
  });

  if (singleUtxo) {
    const totalValue = new BigNumber(singleUtxo.value);
    const requiredSats = buildEstimatedRequiredSats({
      amountSats,
      feeRateSatPerVByte,
      inputCount: 1,
    });

    return {
      address: singleUtxo.address,
      selectedUtxos: [singleUtxo],
      totalValue,
      wasteSats: totalValue.minus(requiredSats),
    };
  }

  const selectedUtxos: IBtcSwapUtxo[] = [];
  let totalValue = new BigNumber(0);
  const sortedDescUtxos = utxos.toSorted((a, b) =>
    new BigNumber(b.value).comparedTo(a.value),
  );
  for (const utxo of sortedDescUtxos) {
    selectedUtxos.push(utxo);
    totalValue = totalValue.plus(utxo.value);

    const requiredSats = buildEstimatedRequiredSats({
      amountSats,
      feeRateSatPerVByte,
      inputCount: selectedUtxos.length,
    });

    if (totalValue.gte(requiredSats)) {
      return {
        address: selectedUtxos[0].address,
        selectedUtxos,
        totalValue,
        wasteSats: totalValue.minus(requiredSats),
      };
    }
  }

  return undefined;
}

type IBtcSwapUtxoCandidate = NonNullable<
  ReturnType<typeof buildCandidateForAmount>
>;

function isBtcSwapUtxoCandidate(
  value: IBtcSwapUtxoCandidate | undefined,
): value is IBtcSwapUtxoCandidate {
  return Boolean(value);
}

export function buildBtcSingleAddressUtxoPlanFromUtxos({
  amount,
  decimals,
  feeRateSatPerVByte,
  utxos,
}: {
  amount: string;
  decimals: number;
  feeRateSatPerVByte?: string;
  utxos: IBtcSwapUtxo[];
}): IBtcSwapSingleAddressUtxoPlan | undefined {
  const amountSats = toSatsBN({ amount, decimals });

  if (!amountSats.isFinite() || amountSats.lte(0)) {
    return undefined;
  }

  const utxosByAddress = utxos.reduce<Record<string, IBtcSwapUtxo[]>>(
    (result, utxo) => {
      if (
        !utxo.address ||
        !utxo.txid ||
        !Number.isInteger(utxo.vout) ||
        new BigNumber(utxo.value).lte(0)
      ) {
        return result;
      }

      result[utxo.address] = result[utxo.address] ?? [];
      result[utxo.address].push(utxo);
      return result;
    },
    {},
  );

  const candidate = Object.values(utxosByAddress)
    .map((groupedUtxos) =>
      buildCandidateForAmount({
        amountSats,
        feeRateSatPerVByte,
        utxos: groupedUtxos,
      }),
    )
    .filter(isBtcSwapUtxoCandidate)
    .toSorted((a, b) => {
      const wasteCompare = a.wasteSats.comparedTo(b.wasteSats);
      if (wasteCompare !== 0) {
        return wasteCompare;
      }

      const inputCountCompare = a.selectedUtxos.length - b.selectedUtxos.length;
      if (inputCountCompare !== 0) {
        return inputCountCompare;
      }

      return a.totalValue.comparedTo(b.totalValue);
    })[0];

  if (candidate) {
    return {
      userAddress: candidate.address,
      refundAddress: candidate.address,
      selectedUtxoKeys: candidate.selectedUtxos.map(buildUtxoKey),
      utxoSelectionStrategy: EUtxoSelectionStrategy.ForceSelected,
    };
  }

  return undefined;
}

export function applyBtcSwapSingleAddressUtxoPlanToTransferInfo({
  plan,
  transferInfo,
}: {
  plan?: IBtcSwapSingleAddressUtxoPlan;
  transferInfo: ITransferInfo;
}) {
  if (!plan) {
    return transferInfo;
  }

  return {
    ...transferInfo,
    from: plan.userAddress,
    selectedUtxoKeys: plan.selectedUtxoKeys,
    utxoSelectionStrategy: plan.utxoSelectionStrategy,
  };
}
