import type { EGalleryRoutes } from '@onekeyhq/shared/src/routes';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IGalleryPersistAtom = {
  galleryLastRoute: EGalleryRoutes | null;
};

export const galleryAtomInitialValue: IGalleryPersistAtom = {
  galleryLastRoute: null,
};

export const { target: galleryPersistAtom, use: useGalleryPersistAtom } =
  globalAtom<{
    galleryLastRoute: EGalleryRoutes | null;
  }>({
    persist: true,
    name: EAtomNames.galleryPersistAtom,
    initialValue: galleryAtomInitialValue,
  });
