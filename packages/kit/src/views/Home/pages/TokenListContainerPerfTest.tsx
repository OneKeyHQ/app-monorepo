import { useCallback, useEffect } from 'react';

import { isEmpty } from 'lodash';

import type { ITabPageProps } from '@onekeyhq/components';
import type { ISimpleDBLocalTokens } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityLocalTokens';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/perfUtils';
import type { IFetchAccountTokensResp } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAllNetworkRequests } from '../../../hooks/useAllNetwork';
import { useAccountOverviewStateAtom } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

export function TokenListContainerPerfTest(props: ITabPageProps) {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const [, setOverview] = useAccountOverviewStateAtom();

  const empty = useCallback(() => {}, []);

  const handleAllNetworkCacheRequests = useCallback(
    async ({
      accountId,
      networkId,
      xpub,
      accountAddress,
      simpleDbLocalTokensRawData,
    }: {
      accountId: string;
      networkId: string;
      xpub?: string;
      accountAddress: string;
      simpleDbLocalTokensRawData?: ISimpleDBLocalTokens;
    }) => {
      const perf = perfUtils.createPerf(
        EPerformanceTimerLogNames.allNetwork__handleAllNetworkCacheRequests,
      );

      perf.markStart('getAccountLocalTokens', {
        networkId,
        accountAddress,
        rawDataExist: !!simpleDbLocalTokensRawData,
      });
      const localTokens =
        await backgroundApiProxy.serviceToken.getAccountLocalTokens({
          accountId,
          networkId,
          accountAddress,
          xpub,
          simpleDbLocalTokensRawData,
        });
      //   const localTokens =
      //     await globalThis.$backgroundApiProxy.backgroundApi?.serviceToken.getAccountLocalTokens(
      //       {
      //         accountId,
      //         networkId,
      //         accountAddress,
      //         xpub,
      //         simpleDbLocalTokensRawData,
      //       },
      //     );
      perf.markEnd('getAccountLocalTokens');

      const { tokenList, smallBalanceTokenList, riskyTokenList } =
        checkIsDefined(localTokens);

      perf.done();
      if (
        isEmpty(tokenList) &&
        isEmpty(riskyTokenList) &&
        isEmpty(smallBalanceTokenList)
      ) {
        return null;
      }

      return {
        ...localTokens,
        tokenList,
        smallBalanceTokenList,
        riskyTokenList,
        accountId,
        networkId,
      };
    },
    [],
  );

  const handleAllNetworkCacheData = useCallback(() => {
    setOverview({
      isRefreshing: false,
      initialized: true,
    });
  }, [setOverview]);

  useAllNetworkRequests<IFetchAccountTokensResp>({
    account,
    network,
    wallet,
    allNetworkRequests: empty as any,
    allNetworkCacheRequests: handleAllNetworkCacheRequests,
    allNetworkCacheData: handleAllNetworkCacheData,
    clearAllNetworkData: empty as any,
    onStarted: empty as any,
    onFinished: empty as any,
    interval: 200,
    shouldAlwaysFetch: false,
  });

  useEffect(() => {
    setOverview({
      isRefreshing: true,
      initialized: false,
    });
  }, [setOverview]);

  return null;
}
