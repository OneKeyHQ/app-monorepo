import { useContext } from 'react';

import { PageTypeContext } from './context';

export const usePageType = () => {
  const pageTypeContext = useContext(PageTypeContext);
  return pageTypeContext.pageType;
};

export { EPageType } from './pageType';
