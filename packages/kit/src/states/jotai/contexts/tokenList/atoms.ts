import type { IListStructure } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import { ETokenListSortType } from '@onekeyhq/shared/types/token';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextTokenList,
  withProvider: withTokenListProvider,
  contextAtom,
  contextAtomMethod,
  useContextData: useTokenListContextData,
} = createJotaiContext();
export {
  ProviderJotaiContextTokenList,
  contextAtomMethod,
  withTokenListProvider,
  // Exposes the per-store handle for the cell seam (cells/projection.ts,
  // cells/useTokenFiat.ts). Other consumers should keep using the typed
  // `use*Atom` hooks.
  useTokenListContextData,
};

export const { atom: searchTokenStateAtom, use: useSearchTokenStateAtom } =
  contextAtom<{
    isSearching: boolean;
  }>({
    isSearching: false,
  });

export const { atom: searchTokenListAtom, use: useSearchTokenListAtom } =
  contextAtom<{
    tokens: IAccountToken[];
  }>({
    tokens: [],
  });

export const {
  atom: activeAccountTokenListAtom,
  use: useActiveAccountTokenListAtom,
} = contextAtom<{ tokens: IAccountToken[]; keys: string }>({
  tokens: [],
  keys: '',
});

export const { atom: searchKeyAtom, use: useSearchKeyAtom } =
  contextAtom<string>('');

/**
 * TokenList cells — structure atom (spec §3, Phase-1 Slice 1).
 *
 * Lives in the existing per-store contextAtom store. Holds ONLY the ids +
 * aggregate membership + owner/generation; per-key fiat/meta VALUES live in
 * the cells registered in `storeProjection` (cells/projection.ts). Price ticks
 * write cells and do NOT touch this atom — that low frequency is the premise
 * of "only the changed leaf re-renders" (spec §4.1, §5).
 *
 * Written exclusively via `applyStructureSnapshot` (cells/projection.ts); never
 * set directly by components (spec §4.1).
 */
export const { atom: listStructureAtom, use: useListStructureAtom } =
  contextAtom<IListStructure>({
    orderedIds: [],
    smallBalanceIds: [],
    nonZeroIds: [],
    fundedIds: [],
    aggMembership: {},
    ownerKey: '',
    generation: -1,
    smallBalanceFiatValue: '0',
    ownedAggregateTokenListMap: {},
  });

/**
 * TokenList cells — risky frame projection atom (design 2026-06-16 §R0).
 *
 * The UI receive shell (`useTokenListCellsProducer`) lands the BG risky frame
 * (PUSH + PULL) here, version-guarded + identity-checked, as a FULL idempotent
 * snapshot. `TokenListFooter` reads it (R1 migrated the footer off the deleted
 * legacy risky whole-map atoms onto this single frame). The
 * risky set is risk-blind in the home structure/valuation frames, so it rides a
 * dedicated channel with its OWN monotonic version. `ownerKey` is the applied
 * owner so a reader can confirm the snapshot belongs to its scoped owner.
 */
export const { atom: riskyListFrameAtom, use: useRiskyListFrameAtom } =
  contextAtom<{
    riskyTokens: IAccountToken[];
    riskyMap: { [key: string]: ITokenFiat };
    ownerKey: string;
  }>({
    riskyTokens: [],
    riskyMap: {},
    ownerKey: '',
  });

export const { atom: tokenListStateAtom, use: useTokenListStateAtom } =
  contextAtom<{
    address: string;
    isRefreshing: boolean;
    initialized: boolean;
  }>({
    address: '',
    isRefreshing: true,
    initialized: false,
  });

export const {
  atom: activeAccountTokenListStateAtom,
  use: useActiveAccountTokenListStateAtom,
} = contextAtom<{
  isRefreshing: boolean;
  initialized: boolean;
}>({
  isRefreshing: false,
  initialized: false,
});

export const { atom: createAccountStateAtom, use: useCreateAccountStateAtom } =
  contextAtom<{
    token: IAccountToken | null;
    isCreating: boolean;
  }>({
    token: null,
    isCreating: false,
  });

export const {
  atom: processingTokenStateAtom,
  use: useProcessingTokenStateAtom,
} = contextAtom<{
  token: IAccountToken | null;
  isProcessing: boolean;
}>({
  token: null,
  isProcessing: false,
});

export const { atom: tokenListSortAtom, use: useTokenListSortAtom } =
  contextAtom<{
    sortType: ETokenListSortType;
    sortDirection: 'desc' | 'asc';
  }>({
    sortType: ETokenListSortType.Value,
    sortDirection: 'desc',
  });
