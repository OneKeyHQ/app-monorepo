import type { IHomeStoreState } from './homeStoreTypes';

export type IHomeStoreInvariantViolation =
  | 'factsOwnerMismatch'
  | 'navigationSelectedTabMissing'
  | 'confirmedBalanceOwnerMismatch'
  | 'confirmedBalanceSourceMismatch';

export function validateHomeStoreInvariants(
  state: IHomeStoreState,
): readonly IHomeStoreInvariantViolation[] {
  const violations: IHomeStoreInvariantViolation[] = [];
  const factsOwner = state.facts?.owner;
  const sessionOwner = state.session.owner;
  const ownersMatch = Boolean(
    factsOwner &&
    sessionOwner &&
    factsOwner.walletId === sessionOwner.walletId &&
    factsOwner.accountId === sessionOwner.accountId &&
    factsOwner.network.kind === sessionOwner.network.kind &&
    (factsOwner.network.kind === 'allNetworks' ||
      (sessionOwner.network.kind === 'singleNetwork' &&
        factsOwner.network.networkId === sessionOwner.network.networkId)),
  );
  if (
    state.facts &&
    (!ownersMatch ||
      !state.session.ownerToken ||
      state.facts.ownerToken.scopeKey !== state.session.ownerToken.scopeKey ||
      state.facts.ownerToken.sessionId !== state.session.ownerToken.sessionId)
  ) {
    violations.push('factsOwnerMismatch');
  }
  if (
    state.navigation.value.kind === 'ready' &&
    !state.navigation.value.tabs.includes(state.navigation.value.selectedTabId)
  ) {
    violations.push('navigationSelectedTabMissing');
  }
  if (
    state.confirmedBalance &&
    state.confirmedBalance.ownerScopeKey !== state.session.ownerToken?.scopeKey
  ) {
    violations.push('confirmedBalanceOwnerMismatch');
  }
  if (
    state.confirmedBalance &&
    state.balanceRound &&
    state.confirmedBalance.sourceKeyIdentity !==
      state.balanceRound.sourceKeyIdentity
  ) {
    violations.push('confirmedBalanceSourceMismatch');
  }
  return violations;
}
