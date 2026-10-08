import {
  perpsAbstractionModeAtom,
  perpsLiquidationRiskInputsAtom,
} from '../../states/jotai/atoms/perps';

import type {
  IPerpsAbstractionModeAtom,
  IPerpsLiquidationRiskInputsAtom,
} from '../../states/jotai/atoms/perps';

// These helpers run in bg. Native/extension main receives only the atom snapshot,
// including its mode, rather than relying on this runtime-local generation.
let liquidationRiskGeneration = 0;

export function getLiquidationRiskGeneration() {
  return liquidationRiskGeneration;
}

export function invalidatePerpsLiquidationRiskInputs(): Promise<void> {
  liquidationRiskGeneration += 1;
  return perpsLiquidationRiskInputsAtom.set(undefined);
}

export async function updatePerpsLiquidationRiskInputs({
  generation,
  accountAddress,
  ...fields
}: Omit<NonNullable<IPerpsLiquidationRiskInputsAtom>, 'abstractionMode'> & {
  generation: number;
}): Promise<void> {
  const abstraction = await perpsAbstractionModeAtom.get();
  if (
    !abstraction?.mode ||
    abstraction.source !== 'live' ||
    abstraction.accountAddress?.toLowerCase() !== accountAddress
  ) {
    return;
  }
  const abstractionMode = abstraction.mode;
  await perpsLiquidationRiskInputsAtom.set((prev) => {
    // Invalidation can happen while the account/mode reads above are pending.
    if (generation !== liquidationRiskGeneration) {
      return prev;
    }
    return {
      ...(prev?.accountAddress === accountAddress &&
      prev.abstractionMode === abstractionMode
        ? prev
        : {}),
      accountAddress,
      abstractionMode,
      ...fields,
    };
  });
}

export async function setPerpsAbstractionModeWithRiskInvalidation(
  next: IPerpsAbstractionModeAtom,
): Promise<void> {
  const previous = await perpsAbstractionModeAtom.get();
  if (
    previous?.accountAddress?.toLowerCase() !==
      next?.accountAddress?.toLowerCase() ||
    previous?.mode !== next?.mode
  ) {
    // Clear before publishing the new mode; source-only refreshes retain data.
    await invalidatePerpsLiquidationRiskInputs();
  }
  await perpsAbstractionModeAtom.set(next);
}
