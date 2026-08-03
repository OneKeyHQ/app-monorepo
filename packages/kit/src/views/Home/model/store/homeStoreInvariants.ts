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
  if (
    state.facts &&
    (!state.session.owner ||
      !state.session.ownerToken ||
      JSON.stringify(state.facts.owner) !==
        JSON.stringify(state.session.owner) ||
      JSON.stringify(state.facts.ownerToken) !==
        JSON.stringify(state.session.ownerToken))
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
