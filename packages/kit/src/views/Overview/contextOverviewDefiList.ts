import type { IOverviewAccountdefisResult } from '@onekeyhq/kit-bg/src/services/ServiceOverview';

import { atom, createJotaiContext } from '../../store/jotai/createJotaiContext';

export const atomHomeOverviewDefiList = atom<IOverviewAccountdefisResult>({
  defis: [],
  defiTotalValue: undefined,
  defiTotalValue24h: undefined,
});

const { withProvider: withProviderDefiList, useContextAtom: useAtomDefiList } =
  createJotaiContext();

export { withProviderDefiList, useAtomDefiList };
