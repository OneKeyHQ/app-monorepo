import { useContext } from 'react';

import { PageTypeContext } from './context';
import { EPageType } from './pageType';

export const usePageType = () => {
  const pageTypeContext = useContext(PageTypeContext);
  return pageTypeContext.pageType;
};

export const useIsModalPage = () => {
  const pageType = usePageType();
  return pageType === EPageType.modal;
};

export const useIsOverlayPage = () => {
  const pageType = usePageType();
  return (
    pageType === EPageType.modal ||
    pageType === EPageType.fullScreen ||
    pageType === EPageType.onboarding
  );
};

export { EPageType } from './pageType';
