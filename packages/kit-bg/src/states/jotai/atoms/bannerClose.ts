import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IBannerClosePersistAtom = {
  ids: string[];
};

export const bannerCloseAtomInitialValue: IBannerClosePersistAtom = {
  ids: [],
};

export const { target: bannerCloseIdsAtom, use: useBannerClosePersistAtom } =
  globalAtom<{
    ids: string[];
  }>({
    persist: true,
    name: EAtomNames.bannerCloseIdsAtom,
    initialValue: bannerCloseAtomInitialValue,
  });
