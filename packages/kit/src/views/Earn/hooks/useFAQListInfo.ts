import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const useFAQListInfo = () => {
  const {
    result: faqList,
    isLoading: isFaqLoading = true,
    run: refetchFAQ,
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

  return { faqList, isFaqLoading, refetchFAQ };
};
