import BigNumber from 'bignumber.js';

import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EUtxoSelectionStrategy } from '@onekeyhq/shared/types/send';

const SWFT_PROVIDER_KEYWORD = 'swft';
const BTC_SWAP_UTXO_FEE_BUFFER_SATS = '10000';
const BTC_SWAP_MIN_EXTRA_SATS = '1';
export const BTC_SWAP_SINGLE_ADDRESS_UTXO_REQUIRED_ERROR_MESSAGE =
  'SWFT BTC swap requires enough spendable BTC from one address.';

export type IBtcSwapUtxo = {
  txid: string;
  vout: number;
  value: string;
  address: string;
};

export type IBtcSwapSingleAddressUtxoPlan = {
  userAddress: string;
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

function buildCandidateForRequiredAmount({
  requiredSats,
  utxos,
}: {
  requiredSats: BigNumber;
  utxos: IBtcSwapUtxo[];
}) {
  const sortedUtxos = utxos.toSorted((a, b) =>
    new BigNumber(a.value).comparedTo(b.value),
  );
  const singleUtxo = sortedUtxos.find((utxo) =>
    new BigNumber(utxo.value).gte(requiredSats),
  );

  if (singleUtxo) {
    return {
      address: singleUtxo.address,
      selectedUtxos: [singleUtxo],
      totalValue: new BigNumber(singleUtxo.value),
    };
  }

  const selectedUtxos: IBtcSwapUtxo[] = [];
  let totalValue = new BigNumber(0);
  utxos
    .toSorted((a, b) => new BigNumber(b.value).comparedTo(a.value))
    .some((utxo) => {
      selectedUtxos.push(utxo);
      totalValue = totalValue.plus(utxo.value);
      return totalValue.gte(requiredSats);
    });

  if (totalValue.gte(requiredSats)) {
    return {
      address: selectedUtxos[0].address,
      selectedUtxos,
      totalValue,
    };
  }

  return undefined;
}

type IBtcSwapUtxoCandidate = NonNullable<
  ReturnType<typeof buildCandidateForRequiredAmount>
>;

function isBtcSwapUtxoCandidate(
  value: IBtcSwapUtxoCandidate | undefined,
): value is IBtcSwapUtxoCandidate {
  return Boolean(value);
}

export function buildBtcSingleAddressUtxoPlanFromUtxos({
  amount,
  decimals,
  utxos,
}: {
  amount: string;
  decimals: number;
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

  const requiredAmounts = [
    amountSats.plus(BTC_SWAP_UTXO_FEE_BUFFER_SATS),
    amountSats.plus(BTC_SWAP_MIN_EXTRA_SATS),
  ];

  for (const requiredSats of requiredAmounts) {
    const candidate = Object.values(utxosByAddress)
      .map((groupedUtxos) =>
        buildCandidateForRequiredAmount({
          requiredSats,
          utxos: groupedUtxos,
        }),
      )
      .filter(isBtcSwapUtxoCandidate)
      .toSorted((a, b) => a.totalValue.comparedTo(b.totalValue))[0];

    if (candidate) {
      return {
        userAddress: candidate.address,
        selectedUtxoKeys: candidate.selectedUtxos.map(buildUtxoKey),
        utxoSelectionStrategy: EUtxoSelectionStrategy.ForceSelected,
      };
    }
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
