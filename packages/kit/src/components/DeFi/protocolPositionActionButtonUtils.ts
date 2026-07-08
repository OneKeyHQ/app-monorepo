import type { IResolvedDeFiPositionAction } from '@onekeyhq/shared/types/defi';

export function getResolvedActionKey(action: IResolvedDeFiPositionAction) {
  return [
    action.protocolId,
    action.networkId,
    action.positionCategory,
    action.assetCategory ?? '',
    action.debtCategory ?? '',
    action.rewardCategory ?? '',
    action.action,
  ].join('-');
}

function normalizeActionIdentityValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().toLowerCase();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function getResolvedActionIdentityValues(action: IResolvedDeFiPositionAction) {
  const values = new Set<string>();
  for (const asset of action.assets) {
    for (const key of ['poolAddress', 'groupId', 'tokenId']) {
      const value = normalizeActionIdentityValue(asset.extraParams?.[key]);
      if (value) {
        values.add(value);
      }
    }
  }
  return values;
}

function hasIdentityOverlap({
  action,
  identityValues,
}: {
  action: IResolvedDeFiPositionAction;
  identityValues: Set<string>;
}) {
  if (identityValues.size === 0) {
    return false;
  }
  return Array.from(getResolvedActionIdentityValues(action)).some((value) =>
    identityValues.has(value),
  );
}

export function findResolvedActionRefreshMatch({
  staleAction,
  freshActions,
}: {
  staleAction: IResolvedDeFiPositionAction;
  freshActions: IResolvedDeFiPositionAction[];
}) {
  const staleKey = getResolvedActionKey(staleAction);
  const staleTokenAddresses = new Set(
    staleAction.assets.map((asset) => asset.tokenAddress ?? ''),
  );
  const staleIdentityValues = getResolvedActionIdentityValues(staleAction);
  let fallbackMatch: IResolvedDeFiPositionAction | undefined;

  for (const freshAction of freshActions) {
    if (getResolvedActionKey(freshAction) === staleKey) {
      if (
        hasIdentityOverlap({
          action: freshAction,
          identityValues: staleIdentityValues,
        })
      ) {
        return freshAction;
      }
      if (staleIdentityValues.size === 0) {
        const overlaps = freshAction.assets.some((asset) =>
          staleTokenAddresses.has(asset.tokenAddress ?? ''),
        );
        if (overlaps) return freshAction;
        fallbackMatch = fallbackMatch ?? freshAction;
      }
    }
  }

  return fallbackMatch;
}
