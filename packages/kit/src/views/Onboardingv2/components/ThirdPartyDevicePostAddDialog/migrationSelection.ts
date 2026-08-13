import type { IThirdPartyAccountNameCandidate } from '@onekeyhq/shared/src/referralCode/type';

// indexedAccountId -> { whether to rename, which offered name was picked }
export type IAccountNameSyncSelection = Record<
  string,
  { checked: boolean; sourceName: string }
>;

function getCandidateNames(
  candidate: IThirdPartyAccountNameCandidate,
): string[] {
  return candidate.sourceNames?.length
    ? candidate.sourceNames
    : [candidate.sourceName];
}

// Everything matched starts checked, so confirming is one click and the user
// only has to touch the rows they want to keep.
export function buildInitialSelection(
  candidates: IThirdPartyAccountNameCandidate[],
): IAccountNameSyncSelection {
  const selection: IAccountNameSyncSelection = {};
  for (const candidate of candidates) {
    const [sourceName] = getCandidateNames(candidate);
    if (sourceName) {
      selection[candidate.indexedAccountId] = { checked: true, sourceName };
    }
  }
  return selection;
}

export function buildRenames({
  candidates,
  selection,
}: {
  candidates: IThirdPartyAccountNameCandidate[];
  selection: IAccountNameSyncSelection;
}): { indexedAccountId: string; name: string }[] {
  const renames: { indexedAccountId: string; name: string }[] = [];
  for (const candidate of candidates) {
    const state = selection[candidate.indexedAccountId];
    if (!state?.checked) {
      continue;
    }
    // Guard against a picked name that is no longer offered.
    if (getCandidateNames(candidate).includes(state.sourceName)) {
      renames.push({
        indexedAccountId: candidate.indexedAccountId,
        name: state.sourceName,
      });
    }
  }
  return renames;
}
