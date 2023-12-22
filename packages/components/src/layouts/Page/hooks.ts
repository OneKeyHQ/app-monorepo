import { useCallback, useContext } from 'react';

import { PageContext } from './PageContext';

export const usePage = () => {
  const { pageOffsetRef, pageRef } = useContext(PageContext);
  const getContentOffset = useCallback(
    () => pageOffsetRef?.current,
    [pageOffsetRef],
  );
  return {
    pageRef: pageRef?.current,
    getContentOffset,
  };
};
