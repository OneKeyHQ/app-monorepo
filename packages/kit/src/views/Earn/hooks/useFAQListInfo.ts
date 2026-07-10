import { useCallback } from 'react';

import { isEqual } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const useFAQListInfo = () => {
  const {
    result: faqList,
    isLoading: isFaqLoading = true,
    setResult: setFaqList,
  } = usePromiseResult(
    async () => {
      const result =
        await backgroundApiProxy.serviceStaking.getFAQListForHome();
      return result;
    },
    [],
    {
      initResult: [],
      watchLoading: true,
    },
  );

  const refetchFAQ = useCallback(async () => {
    const nextFaqList =
      await backgroundApiProxy.serviceStaking.getFAQListForHome();
    setFaqList((previousFaqList) =>
      isEqual(previousFaqList, nextFaqList) ? previousFaqList : nextFaqList,
    );
  }, [setFaqList]);

  return { faqList, isFaqLoading, refetchFAQ };
};
