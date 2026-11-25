import type { IBtcOutput } from '@onekeyhq/core/src/chains/btc/types';

export type IPsbtTaprootAddressDerivation = {
  fullPath: string;
  pubkey: string;
};

export type IResolvedPsbtTaprootOwnedOutput = IPsbtTaprootAddressDerivation & {
  index: number;
};

export function resolvePsbtTaprootOwnedOutputs({
  outputAddresses,
  encodedOutputs,
  accountAddress,
  resolveAddressDerivation,
}: {
  outputAddresses: Array<string | undefined>;
  encodedOutputs: IBtcOutput[];
  accountAddress: string;
  resolveAddressDerivation: (
    address: string,
  ) => IPsbtTaprootAddressDerivation | undefined;
}): IResolvedPsbtTaprootOwnedOutput[] {
  if (outputAddresses.length <= 1) {
    return [];
  }

  const resolvedOutputs: IResolvedPsbtTaprootOwnedOutput[] = [];

  outputAddresses.forEach((outputAddress, index) => {
    if (!outputAddress) {
      return;
    }

    const encodedOutput = encodedOutputs[index];
    const isSelectedAccountOutput = outputAddress === accountAddress;
    const hasOwnedOutputHint =
      encodedOutput?.address === outputAddress &&
      (encodedOutput.payload?.isChange ||
        encodedOutput.payload?.isInscriptionStructure);

    if (!isSelectedAccountOutput && !hasOwnedOutputHint) {
      return;
    }

    const derivation = resolveAddressDerivation(outputAddress);
    if (derivation) {
      resolvedOutputs.push({ index, ...derivation });
    }
  });

  return resolvedOutputs;
}
